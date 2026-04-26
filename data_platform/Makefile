# Run from inside data_platform/

.PHONY: install dev bronze dbt-run dbt-test docs clean

install:
	pip install -e ".[dev]" -r requirements.txt
	dbt deps --project-dir . --profiles-dir .

dev:
	dagster dev

bronze:
	dagster asset materialize --select "raw_transactions raw_categories raw_budgets raw_jobs raw_shifts"

dbt-run:
	dbt run --project-dir . --profiles-dir .

dbt-test:
	dbt test --project-dir . --profiles-dir .

docs:
	dbt docs generate --project-dir . --profiles-dir .
	dbt docs serve --project-dir . --profiles-dir .

clean:
	rm -rf target/ dbt_packages/ logs/
