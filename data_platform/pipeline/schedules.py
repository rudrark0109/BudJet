from dagster import ScheduleDefinition
from .jobs import full_pipeline_job

# Run the full pipeline every 15 minutes.
# In local dev you can trigger manually from the Dagster UI instead.
pipeline_schedule = ScheduleDefinition(
    job=full_pipeline_job,
    cron_schedule="*/15 * * * *",
    execution_timezone="UTC",
)
