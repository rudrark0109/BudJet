"""
Dagster assets that wrap dbt Silver + Gold runs.

After Bronze extraction completes, these assets trigger `dbt run`
for each layer and surface individual model success/failure.
"""

import sys
import json
import subprocess
from pathlib import Path

from dagster import asset, AssetExecutionContext, Output, MetadataValue

from ..resources import DuckDBResource

DBT_PROJECT_DIR = Path(__file__).parent.parent.parent  # data_platform/
DBT_PROFILES_DIR = DBT_PROJECT_DIR                      # profiles.yml lives here

GOLD_TABLES = [
    "fct_transactions",
    "dim_categories",
    "mart_monthly_spend",
    "mart_budget_vs_actual",
    "mart_cashflow",
    "mart_earnings_summary",
    "mart_pay_cycle",
]


def _dbt() -> str:
    """Return the dbt executable inside the active venv.

    Looks next to sys.executable (the venv Python) instead of searching
    the system PATH, so we never accidentally pick up the dbt Cloud CLI.
    """
    scripts_dir = Path(sys.executable).parent      # .venv/Scripts/ on Windows
    for name in ("dbt.exe", "dbt"):                # Windows first, then Unix
        candidate = scripts_dir / name
        if candidate.exists():
            return str(candidate)
    raise RuntimeError(
        f"dbt not found in {scripts_dir}. Run: pip install dbt-core dbt-duckdb"
    )


def _run_dbt(context: AssetExecutionContext, select: str, layer: str) -> str:
    cmd = [
        _dbt(), "run",
        "--project-dir", str(DBT_PROJECT_DIR),
        "--profiles-dir", str(DBT_PROFILES_DIR),
        "--select", select,
    ]
    context.log.info(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(DBT_PROJECT_DIR))

    if result.stdout:
        context.log.info(result.stdout)
    if result.stderr:
        context.log.info(result.stderr)

    if result.returncode != 0:
        raise RuntimeError(
            f"dbt run failed for layer '{layer}'.\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result.stdout


def _test_dbt(context: AssetExecutionContext, select: str) -> None:
    cmd = [
        _dbt(), "test",
        "--project-dir", str(DBT_PROJECT_DIR),
        "--profiles-dir", str(DBT_PROFILES_DIR),
        "--select", select,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(DBT_PROJECT_DIR))
    if result.stdout:
        context.log.info(result.stdout)
    if result.returncode != 0:
        context.log.warning(f"dbt test failures for '{select}'")
    else:
        context.log.info(f"dbt tests passed for '{select}'")


def _parse_run_results() -> dict[str, dict]:
    """Read dbt's target/run_results.json and return per-model status + timing."""
    results_path = DBT_PROJECT_DIR / "target" / "run_results.json"
    if not results_path.exists():
        return {}
    with open(results_path) as f:
        data = json.load(f)
    models = {}
    for r in data.get("results", []):
        name = r["unique_id"].split(".")[-1]
        models[name] = {
            "status": r.get("status", "unknown"),
            "time_s": round(r.get("execution_time", 0), 3),
        }
    return models


def _gold_row_counts(duckdb_resource: DuckDBResource) -> dict[str, int]:
    """Query DuckDB for the row count of every Gold table."""
    counts = {}
    conn = duckdb_resource.get_connection(read_only=True)
    try:
        for table in GOLD_TABLES:
            try:
                row = conn.execute(f"SELECT COUNT(*) FROM main_gold.{table}").fetchone()
                counts[table] = row[0] if row else 0
            except Exception:
                counts[table] = -1   # table missing or error
    finally:
        conn.close()
    return counts


@asset(
    group_name="silver",
    compute_kind="dbt",
    deps=["raw_transactions", "raw_categories", "raw_budgets", "raw_jobs", "raw_shifts"],
)
def silver_models(context: AssetExecutionContext) -> Output:
    """Run all dbt Silver (staging + intermediate) models and their tests."""
    _run_dbt(context, "silver", "silver")
    _test_dbt(context, "silver")

    model_results = _parse_run_results()
    passed = sum(1 for m in model_results.values() if m["status"] == "success")
    failed = sum(1 for m in model_results.values() if m["status"] != "success")

    # Build one metadata entry per model: "model_name" → "success 0.15s"
    model_meta = {
        name: MetadataValue.text(f"{info['status']}  ({info['time_s']}s)")
        for name, info in model_results.items()
    }

    return Output(
        value=passed,
        metadata={
            "models_passed": MetadataValue.int(passed),
            "models_failed": MetadataValue.int(failed),
            **model_meta,
        },
    )


@asset(
    group_name="gold",
    compute_kind="dbt",
    deps=["silver_models"],
)
def gold_models(
    context: AssetExecutionContext,
    duckdb_resource: DuckDBResource,
) -> Output:
    """Run all dbt Gold (marts + facts + dims) models and their tests."""
    _run_dbt(context, "gold", "gold")
    _test_dbt(context, "gold")

    model_results = _parse_run_results()
    passed = sum(1 for m in model_results.values() if m["status"] == "success")
    failed = sum(1 for m in model_results.values() if m["status"] != "success")

    row_counts = _gold_row_counts(duckdb_resource)

    model_meta = {
        name: MetadataValue.text(f"{info['status']}  ({info['time_s']}s)")
        for name, info in model_results.items()
    }
    count_meta = {
        f"rows_{table}": MetadataValue.int(count)
        for table, count in row_counts.items()
    }

    return Output(
        value=passed,
        metadata={
            "models_passed": MetadataValue.int(passed),
            "models_failed": MetadataValue.int(failed),
            **model_meta,
            **count_meta,
        },
    )
