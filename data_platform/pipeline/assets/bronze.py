"""
Bronze extraction assets.

Each asset:
  1. Reads one Postgres table in full (simple baseline — incremental partitions come later).
  2. Adds a _extracted_at timestamp column.
  3. Writes a Parquet file under storage/bronze/<table>/data.parquet.
  4. Registers (or replaces) the table in DuckDB so dbt Silver models can query it.
"""

import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from dagster import asset, AssetExecutionContext, Output, MetadataValue

from ..resources import PostgresResource, DuckDBResource

BRONZE_DIR = Path(__file__).parent.parent.parent / "storage" / "bronze"
BRONZE_DIR.mkdir(parents=True, exist_ok=True)


def _extract_table(
    context: AssetExecutionContext,
    postgres: PostgresResource,
    duckdb: DuckDBResource,
    table_name: str,
    query: str,
) -> Output:
    """Shared helper: extract → Parquet → DuckDB."""
    extracted_at = datetime.now(timezone.utc).isoformat()

    # 1. Read from Postgres
    conn = postgres.get_connection()
    try:
        df = pd.read_sql(query, conn)
    finally:
        conn.close()

    df["_extracted_at"] = extracted_at

    # 2. Write Parquet — always write, even for 0 rows, so DuckDB tables always exist
    out_dir = BRONZE_DIR / table_name
    out_dir.mkdir(parents=True, exist_ok=True)
    parquet_path = out_dir / "data.parquet"
    df.to_parquet(parquet_path, index=False)
    context.log.info(f"Wrote {len(df)} rows to {parquet_path}")

    # 3. Register in DuckDB as raw_<table>
    raw_table = f"raw_{table_name}"
    db_conn = duckdb.get_connection()
    try:
        db_conn.execute(f"""
            CREATE OR REPLACE TABLE {raw_table} AS
            SELECT * FROM read_parquet('{parquet_path}')
        """)
        context.log.info(f"DuckDB table '{raw_table}' updated ({len(df)} rows).")
    finally:
        db_conn.close()

    if df.empty:
        context.log.warning(f"{table_name}: 0 rows — table exists in DuckDB but is empty.")

    return Output(
        value=len(df),
        metadata={
            "row_count": MetadataValue.int(len(df)),
            "parquet_path": MetadataValue.path(str(parquet_path)),
            "extracted_at": MetadataValue.text(extracted_at),
        },
    )


@asset(group_name="bronze", compute_kind="postgres")
def raw_transactions(
    context: AssetExecutionContext,
    postgres: PostgresResource,
    duckdb_resource: DuckDBResource,
) -> Output:
    return _extract_table(
        context, postgres, duckdb_resource,
        "transactions",
        "SELECT id, user_id, category_id, amount, description, type, transaction_date, created_at FROM transactions",
    )


@asset(group_name="bronze", compute_kind="postgres")
def raw_categories(
    context: AssetExecutionContext,
    postgres: PostgresResource,
    duckdb_resource: DuckDBResource,
) -> Output:
    return _extract_table(
        context, postgres, duckdb_resource,
        "categories",
        "SELECT id, user_id, name, type, color, created_at FROM categories",
    )


@asset(group_name="bronze", compute_kind="postgres")
def raw_budgets(
    context: AssetExecutionContext,
    postgres: PostgresResource,
    duckdb_resource: DuckDBResource,
) -> Output:
    return _extract_table(
        context, postgres, duckdb_resource,
        "budgets",
        "SELECT id, user_id, category_id, amount, month, created_at FROM budgets",
    )


@asset(group_name="bronze", compute_kind="postgres")
def raw_jobs(
    context: AssetExecutionContext,
    postgres: PostgresResource,
    duckdb_resource: DuckDBResource,
) -> Output:
    return _extract_table(
        context, postgres, duckdb_resource,
        "jobs",
        "SELECT id, user_id, name, hourly_rate, is_active, created_at FROM jobs",
    )


@asset(group_name="bronze", compute_kind="postgres")
def raw_shifts(
    context: AssetExecutionContext,
    postgres: PostgresResource,
    duckdb_resource: DuckDBResource,
) -> Output:
    return _extract_table(
        context, postgres, duckdb_resource,
        "shifts",
        "SELECT id, user_id, job_id, shift_date, clock_in, clock_out, created_at, updated_at FROM shifts",
    )
