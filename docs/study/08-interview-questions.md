# Interview Questions — BudJet Data Platform

> Compiled list of every likely interview question about this project, organized by topic. Each answer is calibrated to be honest about the project's scope while demonstrating real understanding.

---

## Architecture & Design Decisions

**Q: Walk me through the architecture of your data platform.**

A: BudJet has two separate data layers. The write path is a traditional OLTP stack: React → Express → Postgres. Every user action — logging a transaction, clocking into a shift — hits Postgres directly through Firebase-authenticated REST routes.

The read-for-analytics path is a medallion lakehouse. A Dagster asset runs every 15 minutes, extracts new records from Postgres into Parquet files (Bronze layer). dbt then transforms Bronze through a Silver cleaning layer (typed, validated, deduplicated) into Gold analytics tables (pre-aggregated marts). The Express analytics API reads from the Gold DuckDB tables and serves JSON to a React Insights page.

The key architectural principle: writes and reads are completely decoupled. Postgres is the system of record; DuckDB is the analytics cache.

---

**Q: Why DuckDB instead of just adding more queries to Postgres?**

A: Three reasons. First, analytical queries — full-table scans, multi-column aggregations, window functions — compete for resources with transactional writes on the same database. Separating them eliminates contention. Second, DuckDB's columnar storage and vectorized execution makes analytical queries significantly faster than Postgres for aggregation workloads. Third, the separation enforces a clean architecture: dbt's SQL transforms become the tested, version-controlled definition of business metrics, rather than raw SQL buried in Express route handlers.

---

**Q: Why Dagster over Airflow?**

A: Dagster's asset-oriented model better matches our use case. In Airflow, you track task execution (did `run_dbt` succeed?). In Dagster, you track data artifacts (is `mart_monthly_spend` fresh?). For a data pipeline, knowing the state of your data is more useful than knowing whether a task ran.

Practically, Dagster's `dagster dev` command runs the entire orchestration system locally in one process with no scheduler daemon. Airflow requires a separate scheduler, worker, and metadata database to run locally. For a project developed on a laptop, this matters.

---

**Q: Why Parquet for Bronze storage?**

A: Parquet is a columnar file format that's self-describing (stores its own schema), language-agnostic (readable by Python, Spark, Trino, BigQuery, DuckDB), and compresses well. DuckDB reads Parquet natively with predicate pushdown — it can skip entire files based on column statistics without reading them. Compared to CSV: Parquet is typed, compressed, and columnar; CSV is plain text, uncompressed, and row-oriented.

---

**Q: Why dbt instead of writing raw SQL scripts?**

A: dbt brings software engineering practices to SQL. Without dbt: SQL scripts run in undefined order, have no tests, are undocumented, and live as files with no dependency tracking. With dbt: models have explicit dependencies (resolved into a DAG), built-in tests (`not_null`, `unique`, `accepted_values`) that fail CI if violated, column-level documentation, and a visual lineage graph. Transforms are also warehouse-portable — the same dbt SQL runs on DuckDB locally and BigQuery in the cloud by changing `profiles.yml`.

---

**Q: The data is 15 minutes stale. Is that acceptable?**

A: For this use case, yes. The analytics surface answers questions like "what's my spending trend this month?" or "am I over budget on groceries?" These questions don't require real-time data. A user who logs a transaction and immediately refreshes their analytics page seeing slightly stale numbers is not a UX problem — they just logged it, they know it's there.

If real-time analytics were required, the architecture would change: use Postgres logical replication (CDC) to stream changes to Kafka, consume with Flink or Spark Streaming into DuckDB. That adds significant operational complexity. The 15-minute batch cadence is a deliberate tradeoff, not a limitation.

---

## Data Modeling

**Q: Explain the medallion architecture.**

A: Bronze is the immutable raw landing zone — exactly what Postgres had at extraction time, stored as Parquet. Nothing is changed. This is the audit trail.

Silver applies cleaning and business rules: type casting (strings to decimals, dates), deduplication, NULL handling, enum validation. Silver models are dbt views — they don't store data, they recompute on top of Bronze on every query.

Gold contains pre-aggregated business-facing tables: facts (one row per event) and marts (pre-aggregated to specific grains like user × category × month). Gold models are dbt tables — computed once per `dbt run`, then read by the API.

---

**Q: What is grain? Give an example from this project.**

A: Grain is the definition of what one row represents in a table. For `fct_transactions`, grain is one transaction event. For `mart_monthly_spend`, grain is one user × one category × one month. Getting grain wrong causes double-counting — if the same user/category/month combination appears twice, `SUM(total_amount)` doubles. We enforce grain with dbt `unique` tests on the grain columns.

---

**Q: What's the difference between a fact table and a mart?**

A: A fact table (`fct_transactions`) is at the atomic event grain — one row per transaction. A mart (`mart_monthly_spend`) is pre-aggregated to a specific business grain. Facts are reusable — multiple marts are derived from `fct_transactions`. Marts answer specific business questions and are optimized for specific query patterns.

---

**Q: How would you handle a user renaming a category? (SCD)**

A: This is a Slowly Changing Dimension problem. We use SCD Type 1: when a category name changes in Postgres, the next dbt run updates `dim_categories` with the new name. Historical transactions in `fct_transactions` will display under the new category name — they lose the old name. This is a known tradeoff: simplicity over historical accuracy. If tracking "what did I call this category in January?" were a requirement, we'd use SCD Type 2: add a new dimension row with `valid_from/valid_to` dates and update `fct_transactions` to join on the dimension's valid-at-time version.

---

## SQL & Technical

**Q: How do you compute budget vs actual in SQL?**

```sql
SELECT
    a.user_id,
    a.category_name,
    a.month,
    a.total_amount          AS actual_spend,
    b.budget_amount,
    b.budget_amount - a.total_amount AS remaining,
    CASE
        WHEN b.budget_amount IS NULL THEN 'no_budget'
        WHEN a.total_amount > b.budget_amount THEN 'over'
        WHEN a.total_amount > b.budget_amount * 0.8 THEN 'warning'
        ELSE 'ok'
    END AS budget_status
FROM mart_monthly_spend a
LEFT JOIN stg_budgets b
    ON a.user_id      = b.user_id
   AND a.category_name = b.category_name
   AND a.month        = DATE_TRUNC('month', b.month::DATE)
```

LEFT JOIN preserves all actual spend rows, even categories with no budget set.

---

**Q: How would you handle incremental loads? (not re-extracting everything)**

A: With Dagster daily partitions. Each Bronze asset run extracts only one day's transactions (`WHERE DATE(created_at) = :date`). Older partitions are not re-extracted. On the Gold side, `fct_transactions` uses dbt's `incremental` materialization — it appends new rows rather than rebuilding the entire table on every `dbt run`.

```sql
-- fct_transactions with incremental
{{ config(materialized='incremental', unique_key='transaction_id') }}

SELECT ...
FROM stg_transactions
{% if is_incremental() %}
    WHERE transaction_date >= (SELECT MAX(transaction_date) FROM {{ this }})
{% endif %}
```

---

**Q: How do you test data quality in this pipeline?**

A: At Bronze: Dagster checks row count > 0 for active users (a Dagster asset check).

At Silver: dbt tests — `not_null` on required columns, `accepted_values` on `transaction_type` ('income'|'expense'), `unique` on transaction IDs.

At Gold: dbt `unique` tests on grain columns (prevent double-counting), custom SQL tests like `assert_positive_amounts` (every transaction in fct_transactions has amount > 0), and referential integrity (every `category_id` in fct_transactions exists in `dim_categories`).

Source freshness: `dbt source freshness` checks that Bronze was last updated within an acceptable window (warn after 1 hour, error after 6 hours).

---

## Scale & Production

**Q: Would this architecture work at Airbnb scale?**

A: The architecture pattern would work — medallion lakehouse with Bronze/Silver/Gold is exactly what Airbnb uses (they call it Dataportal). The specific tools would change: DuckDB → Hive/Trino or BigQuery, local Parquet files → S3 with Delta Lake or Iceberg, Dagster on a single machine → Dagster Cloud or Airflow with Kubernetes executors, dbt same but against BigQuery or Redshift.

The value of building this on DuckDB/local is that the same dbt SQL runs unchanged on BigQuery by switching `profiles.yml`. The architectural patterns transfer directly; only the infrastructure layer changes.

---

**Q: What would you add next to this pipeline?**

A: In order of impact:
1. **Incremental dbt models** for `fct_transactions` to avoid full rebuilds.
2. **Dagster sensors** to trigger dbt immediately after Bronze extraction completes, instead of on a separate schedule.
3. **ML layer**: auto-categorization of new transactions using a text classifier (DistilBERT or simpler TF-IDF), predictions written back to Postgres.
4. **NL-to-SQL**: Claude API endpoint where users ask "what did I spend on food last month?" — generates SQL against Gold, validates with sqlglot, returns answer.
5. **Cloud demo target**: CI job running `dbt run --target cloud-demo` against BigQuery sandbox, demonstrating warehouse portability.

---

## Honest Limitations

**Q: What are the weaknesses of your architecture?**

A: 
- **Single-machine DuckDB**: not horizontally scalable. If data volume grew to hundreds of millions of rows, DuckDB would still work but the architecture would need BigQuery/Redshift.
- **15-minute lag**: acceptable for trend analytics but not for real-time features (like "you just exceeded your budget" alerts).
- **No schema migration tooling on Postgres**: currently a single `schema.sql`. A tool like Flyway or Liquibase would manage schema versions better.
- **dbt full rebuilds on Gold**: the Gold tables are fully rebuilt on every `dbt run`. For large datasets, this is expensive. Incremental models solve this.
- **No data encryption at rest on DuckDB**: the `budjet.duckdb` file is unencrypted. For production personal finance data, this requires encryption.
