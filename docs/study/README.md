# BudJet Data Platform — Study Notes

> Interview prep and deep-dive reference for the OLAP layer of BudJet. Read in order for the first time; use as reference later.

## Documents

| # | File | What it covers |
|---|------|----------------|
| 00 | [Project Context](00-project-context.md) | Why we're building OLAP, what we have, what we're adding |
| 01 | [OLAP vs OLTP](01-olap-vs-oltp.md) | Core distinction, storage layouts, when to use each |
| 02 | [Medallion Architecture](02-medallion-architecture.md) | Bronze/Silver/Gold layers, contracts, data flow |
| 03 | [DuckDB](03-duckdb.md) | Columnar storage, vectorized execution, how we use it |
| 04 | [dbt](04-dbt.md) | Models, ref/source, materializations, tests, Jinja |
| 05 | [Dagster](05-dagster.md) | Assets, jobs, schedules, sensors, partitions |
| 06 | [Data Modeling](06-data-modeling.md) | Star schema, facts, dims, grain, SCD |
| 07 | [Pipeline Walkthrough](07-pipeline-walkthrough.md) | One transaction traced end-to-end through the full stack |
| 08 | [Interview Q&A](08-interview-questions.md) | Compiled answers to every likely interview question |

## Technology stack

```
Postgres (OLTP) → Dagster extract → Bronze Parquet
                                           ↓
                                    dbt Silver (views)
                                           ↓
                                    dbt Gold (tables in DuckDB)
                                           ↓
                               Express /api/analytics/* → React /insights
```

| Technology | Version | Role |
|------------|---------|------|
| DuckDB | 0.10.x | Local analytics warehouse |
| dbt-core | 1.7.x | SQL transformation framework |
| dbt-duckdb | 1.7.x | dbt adapter for DuckDB |
| Dagster | 1.6.x | Pipeline orchestration |
| dagster-dbt | 0.22.x | dbt integration for Dagster |
| Parquet | (format) | Bronze storage |

## Key mental models

- **Bronze = audit trail**: never modified, always re-derivable
- **Silver = trusted data**: typed, tested, business-rule applied
- **Gold = business answers**: pre-aggregated, ready to serve
- **Grain = one row represents**: define this before every table
- **dbt = `make` for SQL**: models, dependencies, tests
- **Dagster = asset tracker**: tracks data freshness, not just task execution
