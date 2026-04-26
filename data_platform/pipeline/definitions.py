import os
from pathlib import Path
from dotenv import load_dotenv
from dagster import Definitions, EnvVar

# Load data_platform/.env so DATABASE_URL is available without manual export
load_dotenv(Path(__file__).parent.parent / ".env")
from .assets import (
    raw_transactions, raw_categories, raw_budgets, raw_jobs, raw_shifts,
    silver_models, gold_models,
)
from .jobs import bronze_job, full_pipeline_job
from .schedules import pipeline_schedule
from .resources import PostgresResource, DuckDBResource

# Resolve the DuckDB file path relative to this package (data_platform/budjet.duckdb)
_HERE = os.path.dirname(os.path.dirname(__file__))   # data_platform/
_DUCKDB_PATH = os.path.join(_HERE, "budjet.duckdb")

defs = Definitions(
    assets=[
        raw_transactions,
        raw_categories,
        raw_budgets,
        raw_jobs,
        raw_shifts,
        silver_models,
        gold_models,
    ],
    jobs=[bronze_job, full_pipeline_job],
    schedules=[pipeline_schedule],
    resources={
        "postgres": PostgresResource(
            connection_string=os.environ.get("DATABASE_URL", "")
        ),
        "duckdb_resource": DuckDBResource(db_path=_DUCKDB_PATH),
    },
)
