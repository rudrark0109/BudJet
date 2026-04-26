# Dagster — Orchestration

> Dagster runs the pipeline. It extracts from Postgres, triggers dbt, and gives us a UI to see what ran, when, and why.

---

## What is an orchestrator?

An orchestrator schedules and monitors the data pipeline. Without one, you'd have:
- A cron job that runs `python extract.py` at 3 AM.
- No visibility if it failed.
- No lineage between extraction and transformation.
- No way to re-run just one step.
- No partitioning for historical backfills.

Dagster is our orchestrator. It provides all of the above, plus an asset-oriented programming model that maps naturally to a data pipeline.

---

## Dagster vs Airflow

Both are orchestrators. The critical difference is the mental model:

**Airflow** is **task-oriented**: you define a DAG of tasks (`extract_task → transform_task → load_task`). Tasks are code that runs. Airflow tracks whether tasks succeeded or failed, but it has no concept of the *data* produced by a task.

**Dagster** is **asset-oriented**: you define **assets** — named, versioned data artifacts (a Parquet file, a DuckDB table, a trained model). Assets declare what they produce and what they depend on. Dagster knows the current state of each asset and whether it's "fresh."

Why asset-oriented matters for us:
- We can ask "is the `mart_monthly_spend` table up to date?" — not just "did the `run_dbt` task succeed?"
- Lineage from Postgres → Bronze Parquet → Silver view → Gold table is visible in the Dagster UI.
- Re-running a failed Gold model doesn't re-extract from Postgres unnecessarily.

---

## Core concepts

### Asset

An **asset** is a named data artifact that Dagster tracks. In code, it's a Python function decorated with `@asset`:

```python
from dagster import asset
import duckdb
import pandas as pd
import psycopg2

@asset(
    group_name="bronze",
    partitions_def=DailyPartitionsDefinition(start_date="2024-01-01")
)
def raw_transactions(context) -> None:
    """Extract transactions from Postgres into Bronze Parquet."""
    date = context.partition_key          # e.g., "2024-01-15"

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    df = pd.read_sql(
        "SELECT * FROM transactions WHERE DATE(created_at) = %s",
        conn,
        params=[date]
    )

    output_path = f"storage/bronze/raw_transactions/date={date}/transactions.parquet"
    df.to_parquet(output_path, index=False)
    context.log.info(f"Wrote {len(df)} rows to {output_path}")
```

The function name `raw_transactions` is the asset name. Dagster tracks when it last ran, how many rows it produced, and whether it succeeded.

### Asset dependency

Assets declare dependencies via their function parameters:

```python
@asset(group_name="bronze")
def raw_categories(context) -> None:
    # ... extract categories

@asset(group_name="silver", deps=[raw_transactions, raw_categories])
def dbt_silver_models(context) -> None:
    # Run dbt run --select silver
    subprocess.run(["dbt", "run", "--select", "silver"], check=True)
```

Dagster builds a dependency graph from these declarations. Running `raw_transactions` before `dbt_silver_models` is guaranteed.

### Job

A **job** is a selection of assets to run together. Assets in a job execute in dependency order.

```python
from dagster import define_asset_job

bronze_pipeline = define_asset_job(
    name="bronze_pipeline",
    selection=["raw_transactions", "raw_shifts", "raw_budgets", "raw_categories"]
)

full_pipeline = define_asset_job(
    name="full_pipeline",
    selection=AssetSelection.all()  # run everything
)
```

### Schedule

A **schedule** triggers a job on a cron expression:

```python
from dagster import ScheduleDefinition

bronze_schedule = ScheduleDefinition(
    job=bronze_pipeline,
    cron_schedule="*/15 * * * *",   # every 15 minutes
    execution_timezone="UTC"
)
```

### Sensor

A **sensor** triggers a job when a condition is met, rather than on a fixed schedule:

```python
from dagster import sensor, RunRequest

@sensor(job=full_pipeline)
def bronze_freshness_sensor(context):
    """Run full pipeline when new Bronze files appear."""
    # Check if new Parquet files exist since last sensor tick
    if new_bronze_files_exist():
        yield RunRequest(run_key=str(datetime.now()))
```

In our pipeline, we could use a sensor to chain Bronze → Silver/Gold: when Bronze extraction finishes, automatically trigger dbt.

### Partitions

**Partitions** split data into discrete chunks. We partition our Bronze assets by date.

```python
from dagster import DailyPartitionsDefinition

daily_partitions = DailyPartitionsDefinition(start_date="2024-01-01")

@asset(partitions_def=daily_partitions)
def raw_transactions(context) -> None:
    date = context.partition_key    # "2024-01-15", "2024-01-16", etc.
    # extract only that day's data
```

Benefits of partitions:
- **Incremental runs**: only extract today's data, not all history.
- **Backfills**: re-run just a specific date range if Bronze was corrupted.
- **Parallelism**: multiple partitions can run simultaneously.

Without partitions, every run would re-extract the entire Postgres table. With daily partitions, each run extracts one day's worth.

### Resource

A **resource** is a configurable dependency (a database connection, an API client) shared across assets:

```python
from dagster import resource, ConfigurableResource

class PostgresResource(ConfigurableResource):
    connection_string: str

    def get_connection(self):
        return psycopg2.connect(self.connection_string)

@asset
def raw_transactions(context, postgres: PostgresResource) -> None:
    conn = postgres.get_connection()
    # ...
```

Resources are configured once in the Dagster `Definitions` object, then injected into assets. In dev, point at a local Postgres; in prod, point at the production instance — without changing the asset code.

---

## Our Dagster project structure

```
data_platform/
└── dagster/
    ├── __init__.py
    ├── assets/
    │   ├── bronze.py        -- extract assets (raw_transactions, raw_shifts, ...)
    │   └── dbt_assets.py    -- dbt Silver + Gold as Dagster assets
    ├── jobs.py              -- job definitions
    ├── schedules.py         -- schedule definitions
    ├── sensors.py           -- sensor definitions (optional)
    ├── resources.py         -- Postgres + DuckDB resources
    └── definitions.py       -- Definitions() object that Dagster loads
```

`definitions.py` is the entry point:
```python
from dagster import Definitions
from .assets.bronze import raw_transactions, raw_shifts, raw_budgets, raw_categories
from .assets.dbt_assets import dbt_silver_models, dbt_gold_models
from .jobs import full_pipeline
from .schedules import bronze_schedule
from .resources import postgres_resource, duckdb_resource

defs = Definitions(
    assets=[raw_transactions, raw_shifts, raw_budgets, raw_categories,
            dbt_silver_models, dbt_gold_models],
    jobs=[full_pipeline],
    schedules=[bronze_schedule],
    resources={
        "postgres": postgres_resource,
        "duckdb": duckdb_resource
    }
)
```

Run locally with: `dagster dev -f data_platform/dagster/definitions.py`

This opens the Dagster UI at `http://localhost:3000`. From there you can:
- View the asset lineage graph.
- Trigger manual runs.
- Inspect run history, logs, metadata.
- Launch backfills for specific date partitions.

---

## How Dagster runs dbt

The cleanest pattern is using dbt's `@dbt_assets` decorator from `dagster-dbt`:

```python
from dagster_dbt import dbt_assets, DbtCliResource

@dbt_assets(manifest=dbt_project_dir / "target/manifest.json")
def budjet_dbt_assets(context, dbt: DbtCliResource):
    yield from dbt.cli(["run"], context=context).stream()
```

This parses dbt's `manifest.json` (generated by `dbt parse`) and exposes every dbt model as a Dagster asset. The Dagster UI shows individual model lineage, not just "dbt ran."

---

## Why Dagster instead of Airflow

| | Airflow | Dagster |
|--|---------|---------|
| Mental model | Task-oriented (did the task run?) | Asset-oriented (is the data fresh?) |
| Local dev | Requires a scheduler daemon + database | `dagster dev` — one command |
| dbt integration | Plugin-based, shows one task | Native, shows individual model assets |
| UI | Good for DAG runs | Better for data lineage |
| Backfills | Manual partition calculation | First-class partition backfill UI |
| Testing | Unit testing is awkward | `build_asset_context()` for easy unit tests |
| Learning curve | Higher (workers, scheduler, metadata DB) | Lower for local development |

For a portfolio project where the entire pipeline runs on a laptop, Dagster's `dagster dev` single-command setup is a significant advantage over Airflow's multi-service setup.

---

## Common interview questions

**Q: What is Dagster and how does it differ from Airflow?**
A: Both are orchestration tools, but Dagster is asset-oriented while Airflow is task-oriented. Dagster tracks the *data* produced by pipeline steps (assets), allowing it to know whether a dataset is fresh. Airflow tracks task execution success/failure. For data engineering pipelines where lineage and data freshness matter, Dagster's model is more natural. Practically, Dagster is also easier to run locally — `dagster dev` vs Airflow's scheduler + worker + metadata database setup.

**Q: What are partitions in Dagster? Why do we use them?**
A: Partitions divide a dataset into discrete chunks (by date, for us). Each partition is independently runnable, re-runnable, and backfillable. We use daily partitions on Bronze assets so each pipeline run only extracts one day of new data rather than re-extracting the entire Postgres table. This makes the pipeline incremental and enables historical backfills — if a partition fails, we re-run just that date.

**Q: What is a Dagster resource?**
A: A resource is a shared, configurable dependency (database connection, API client, file path) injected into assets at runtime. Resources are configured once and reused across many assets. This enables environment-switching: dev resources point at local Postgres, production resources point at production Postgres, without changing asset code.

**Q: How does Dagster integrate with dbt?**
A: Via the `dagster-dbt` package. By pointing it at dbt's `manifest.json`, Dagster exposes every dbt model as an individual Dagster asset. Lineage from Bronze Parquet → Silver dbt view → Gold dbt table is fully visible in the Dagster UI. Running `dbt run` becomes a Dagster asset execution, with individual model success/failure tracked.

**Q: What is a Dagster sensor?**
A: A sensor is a polling function that runs periodically and yields run requests when a condition is met. Unlike schedules (time-based triggers), sensors trigger on events: a new file appearing, a database table count changing, a webhook firing. We could use a sensor to trigger the dbt run automatically after Dagster finishes the Bronze extraction, rather than running them on separate schedules.
