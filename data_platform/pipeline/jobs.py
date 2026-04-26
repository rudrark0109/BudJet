from dagster import define_asset_job, AssetSelection

bronze_job = define_asset_job(
    name="bronze_extraction",
    selection=AssetSelection.groups("bronze"),
    description="Extract all OLTP tables from Postgres into Bronze Parquet + DuckDB.",
)

full_pipeline_job = define_asset_job(
    name="full_pipeline",
    selection=AssetSelection.all(),
    description="End-to-end: Bronze extraction → dbt Silver → dbt Gold.",
)
