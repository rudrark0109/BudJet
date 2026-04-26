# Medallion Architecture — Bronze, Silver, Gold

> The core organizational pattern of our data platform. Every file, every table, every dbt model maps to one of these layers.

---

## What is the medallion architecture?

The medallion architecture (also called **multi-hop architecture**) organizes a data lakehouse into quality tiers. Data flows in one direction — from raw to refined — and each hop adds quality:

```
Source Systems  →  Bronze  →  Silver  →  Gold  →  Consumers
(Postgres)         (Raw)      (Clean)    (Aggregate)  (React, ML)
```

Coined by Databricks, the pattern is now used by virtually every major data platform (Airbnb, Netflix, Shopify, Uber internally use equivalent three-layer patterns under different names).

---

## Bronze layer — "Land it, don't touch it"

### What it is

Bronze is the **immutable raw landing zone**. When Dagster extracts data from Postgres, it writes it exactly as-is into Bronze. No transformations, no type coercions, no deduplication.

### Our Bronze

```
data_platform/storage/bronze/
├── raw_transactions/
│   ├── date=2024-01-01/transactions.parquet
│   ├── date=2024-01-02/transactions.parquet
│   └── ...
├── raw_shifts/
├── raw_budgets/
└── raw_categories/
```

DuckDB registers these as external tables with the `raw_` prefix:
```sql
CREATE TABLE raw_transactions AS
SELECT * FROM read_parquet('storage/bronze/raw_transactions/**/*.parquet');
```

### Why immutability matters

If Silver or Gold models produce wrong numbers, you can always re-derive them from Bronze. Bronze is your **audit trail**. You can answer: "What did Postgres say on January 3rd?" by reading that day's Bronze partition.

Without Bronze, if a Silver transform has a bug, you have to re-extract from Postgres — which may have been updated since. The original state is gone.

### Bronze characteristics

| Property | Value |
|----------|-------|
| Schema enforcement | None — whatever Postgres sends |
| Data types | Often strings (safe default) |
| Deduplication | None |
| Partitioning | By date (`transaction_date` or `extraction_ts`) |
| Format | Parquet |
| Writeable? | Append-only, never modified |

### Interview point: Why Parquet?

Parquet is a **columnar file format** — the file is stored column-by-column, just like a columnar database. This means:
- DuckDB can read just the columns it needs, skipping others.
- Parquet files compress well (often 5–10x smaller than CSV).
- They are self-describing: the file stores its own schema (column names, types).
- Language-agnostic: readable by Python (pandas, polars), Spark, Trino, BigQuery external tables.

Compare to CSV: row-oriented, no compression, no schema, brittle on special characters.

---

## Silver layer — "Make it trustworthy"

### What it is

Silver applies **cleaning, typing, and business rules** to Bronze data. It is where raw strings become typed timestamps, where duplicates are removed, where NULL handling is standardized.

### Our Silver (dbt `staging` + `intermediate` models)

```
data_platform/models/
└── silver/
    ├── staging/
    │   ├── stg_transactions.sql      -- type casts, rename columns
    │   ├── stg_shifts.sql
    │   ├── stg_budgets.sql
    │   └── stg_categories.sql
    └── intermediate/
        ├── int_shifts_with_duration.sql   -- computed columns (hours worked)
        └── int_transactions_enriched.sql  -- join category type onto transaction
```

### What Silver does to a transaction row

Bronze row (all strings from Parquet):
```
txn_id | user_id | amount   | type      | category_id | transaction_date | created_at
"42"   | "abc"   | "50.00"  | "expense" | "7"         | "2024-01-15"     | "2024-01-15T10:30:00"
```

Silver row after `stg_transactions.sql`:
```sql
SELECT
    txn_id::INTEGER            AS transaction_id,
    user_id                    AS user_id,            -- already a string (Firebase UID)
    amount::DECIMAL(12,2)      AS amount,
    type                       AS transaction_type,   -- validated: must be 'income'|'expense'
    category_id::INTEGER       AS category_id,
    transaction_date::DATE     AS transaction_date,
    created_at::TIMESTAMP      AS created_at
FROM {{ source('bronze', 'raw_transactions') }}
WHERE amount IS NOT NULL
  AND amount::DECIMAL > 0
  AND type IN ('income', 'expense')
```

### dbt's role in Silver

dbt is the tool that runs these SQL transforms. It:
- Materializes them as **views** in DuckDB (Silver models are almost always views — they don't store data, they're just saved queries on top of Bronze).
- Tests them: `not_null`, `unique`, `accepted_values`.
- Documents them: column descriptions live in `.yml` files next to the SQL.

Silver views are "free" to recompute — since they're views over Parquet files, they always reflect the latest Bronze data automatically.

---

## Gold layer — "Answer a business question"

### What it is

Gold contains **business-facing aggregates** — the models that directly answer questions a user or analyst would ask. These are materialized as **tables** (not views) because they're expensive to compute and need to be fast to read.

### Our Gold (dbt `marts` models)

| Model | Grain | Business question |
|-------|-------|-------------------|
| `fct_transactions` | One row per transaction | Base fact table, all transactions with category joined |
| `dim_categories` | One row per category per user | Lookup: category name, color, type |
| `mart_monthly_spend` | User × category × month | "How much did I spend on Food in March?" |
| `mart_budget_vs_actual` | User × category × month | "Am I over budget on Utilities?" |
| `mart_earnings_summary` | User × employer × month | "How much did I earn from my part-time job?" |
| `mart_cashflow` | User × month | "What was my net cashflow in Q1?" |
| `mart_pay_cycle` | User × pay cycle | "What did I earn this pay period?" |

### Example: `mart_monthly_spend`

```sql
-- models/gold/mart_monthly_spend.sql
SELECT
    t.user_id,
    c.category_name,
    c.category_type,
    c.color,
    DATE_TRUNC('month', t.transaction_date) AS month,
    SUM(t.amount)                            AS total_amount,
    COUNT(*)                                 AS transaction_count
FROM {{ ref('stg_transactions') }} t
JOIN {{ ref('dim_categories') }} c
    ON t.category_id = c.category_id
   AND t.user_id    = c.user_id
WHERE t.transaction_type = 'expense'
GROUP BY 1, 2, 3, 4, 5
```

The `{{ ref('stg_transactions') }}` syntax is dbt's **ref function** — it creates a dependency link between models. dbt's lineage graph is built from these refs.

### Why Gold is materialized as tables (not views)

Views recompute on every query. The `mart_monthly_spend` query scans every transaction, groups them, and sums amounts. Running that on every API request would be slow.

Gold tables are recomputed by `dbt run` once (on a Dagster schedule), and the pre-aggregated result sits as a table in DuckDB. The Express analytics API queries the pre-aggregated table — instant response.

---

## Data flow timing

```
Time 0:00  — User adds transaction → Postgres
Time 0:15  — Dagster runs → extracts to Bronze Parquet
             dbt run → refreshes Silver views (instantaneous, they're views)
             dbt run → recomputes Gold tables (takes seconds)
Time 0:15  — /api/analytics/* returns updated numbers
```

The total lag between a new transaction and it appearing in analytics: ~15 minutes.

---

## Layer comparison table

| | Bronze | Silver | Gold |
|--|--------|--------|------|
| Storage | Parquet files | DuckDB views | DuckDB tables |
| Schema | Raw (string-heavy) | Typed, validated | Denormalized, aggregated |
| Deduplication | No | Yes | Yes (already deduped in Silver) |
| Tests | Row count > 0 | `not_null`, `unique`, `accepted_values` | Business-rule assertions |
| Written by | Dagster (Python) | dbt (SQL) | dbt (SQL) |
| Read by | dbt Silver models | dbt Gold models | Express API, Streamlit |
| Modifiable? | Never | Recomputed on pipeline run | Recomputed on `dbt run` |
| Purpose | Audit trail | Trusted data | Business answers |

---

## Common interview questions

**Q: What is the medallion architecture?**
A: A multi-layer data organization pattern where raw data (Bronze) is progressively refined into clean data (Silver) and then into business-ready aggregates (Gold). Each layer has a clear contract for data quality. It enables auditability (Bronze is the raw truth), testability (Silver has typed, tested data), and query performance (Gold is pre-aggregated).

**Q: Why not just skip Silver and go Bronze → Gold?**
A: Silver serves multiple Gold models. If you had Bronze → Gold directly, each Gold model would re-implement its own cleaning logic. A bug (say, wrong type cast for `amount`) would need to be fixed in every Gold model separately. Silver centralizes the cleaning so Gold models can trust their inputs.

**Q: What's the difference between a fact table and a dimension table?**
A: Fact tables store measurable business events (a transaction happened, with an amount). Dimension tables store descriptive context (a category has a name, type, and color). Facts reference dimensions by ID. This is the **star schema** — the fact table is the center, dimensions radiate out.

**Q: Why is Bronze immutable?**
A: Immutability is what makes Bronze an audit trail. If analytics numbers are wrong three months from now, you can re-run the entire pipeline from Bronze and reproduce any historical state. If Bronze were mutable, the original source state would be lost.

**Q: How does this differ from a traditional ETL pipeline?**
A: Traditional ETL (Extract → Transform → Load) transforms data before loading it, discarding the raw input. The medallion pattern is more like ELT (Extract → Load → Transform): raw data is loaded first (Bronze), then transformed in-place (Silver, Gold). This preserves the raw input and allows transforms to be re-run without re-extraction from the source.
