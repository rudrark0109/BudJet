# dbt — Data Build Tool

> dbt is the tool that writes Silver and Gold. It turns SQL SELECT statements into tested, documented, version-controlled data models.

---

## What is dbt?

dbt (data build tool) is a **transformation framework** for analytical SQL. It lets you write `SELECT` statements, and dbt handles:
- Running them in the right order (dependency resolution).
- Materializing them as views or tables.
- Testing the results (nulls, uniqueness, referential integrity).
- Documenting columns.
- Generating a lineage graph.

The mental model: **dbt is `make` for SQL**. You define models (SQL files), dbt resolves their dependencies and runs them in the correct order.

dbt does NOT extract data or load data. It only **transforms** data that's already in a warehouse. Our Dagster assets handle extraction from Postgres into Bronze. dbt transforms Bronze → Silver → Gold.

---

## Core concepts

### Model

A **model** is a single `.sql` file containing a `SELECT` statement. The file name becomes the table/view name in the warehouse.

`models/silver/staging/stg_transactions.sql`:
```sql
SELECT
    txn_id::INTEGER         AS transaction_id,
    user_id,
    amount::DECIMAL(12,2)   AS amount,
    type                    AS transaction_type,
    category_id::INTEGER    AS category_id,
    transaction_date::DATE  AS transaction_date,
    created_at::TIMESTAMP   AS created_at
FROM {{ source('bronze', 'raw_transactions') }}
WHERE amount IS NOT NULL
  AND amount::DECIMAL > 0
```

When you run `dbt run`, dbt wraps this SELECT in a `CREATE TABLE AS` or `CREATE VIEW AS` and runs it in DuckDB.

### ref() and source()

These are dbt's **dependency functions**:

```sql
-- ref() references another dbt model
FROM {{ ref('stg_transactions') }}

-- source() references a raw table outside dbt's control
FROM {{ source('bronze', 'raw_transactions') }}
```

When dbt sees `{{ ref('stg_transactions') }}`, it:
1. Adds `stg_transactions` as a dependency of the current model.
2. Substitutes the correct fully-qualified table name for the target warehouse.
3. Ensures `stg_transactions` is built before the current model.

This is how dbt builds a **DAG** (directed acyclic graph) of all models, then runs them in topological order.

### Materialization

Each model has a materialization type — how dbt writes it to the warehouse:

| Type | What dbt does | When to use |
|------|---------------|-------------|
| `view` | `CREATE OR REPLACE VIEW` | Silver staging — no data stored, always fresh |
| `table` | `CREATE TABLE AS SELECT` (full rebuild) | Gold marts — precomputed, fast to read |
| `incremental` | `INSERT` new rows only | Large fact tables — avoid rebuilding from scratch |
| `ephemeral` | Not materialized — inlined as a CTE | Intermediate logic reused within one model |

Configured in the model file or in `dbt_project.yml`:
```yaml
# dbt_project.yml
models:
  budjet:
    silver:
      staging:
        +materialized: view
    gold:
      +materialized: table
```

### Schema tests (dbt tests)

dbt has built-in tests you declare in `.yml` files next to your SQL:

`models/gold/schema.yml`:
```yaml
models:
  - name: mart_monthly_spend
    columns:
      - name: user_id
        tests:
          - not_null
      - name: month
        tests:
          - not_null
      - name: total_amount
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              inclusive: true
```

Run with `dbt test`. dbt executes a SQL query for each test. For `not_null` it runs:
```sql
SELECT COUNT(*) FROM mart_monthly_spend WHERE total_amount IS NULL
```
If the count > 0, the test fails.

Built-in tests: `not_null`, `unique`, `accepted_values`, `relationships`.

Custom tests are plain SQL files in `tests/` that should return 0 rows to pass:
```sql
-- tests/assert_positive_amounts.sql
SELECT * FROM {{ ref('fct_transactions') }}
WHERE amount <= 0
```

### Sources

**Sources** define the raw tables that dbt reads but doesn't own. For us, the Bronze layer:

`models/bronze/schema.yml`:
```yaml
sources:
  - name: bronze
    tables:
      - name: raw_transactions
      - name: raw_shifts
      - name: raw_budgets
      - name: raw_categories
```

Sources can also have tests and freshness checks:
```yaml
sources:
  - name: bronze
    freshness:
      warn_after: {count: 1, period: hour}
      error_after: {count: 6, period: hour}
    tables:
      - name: raw_transactions
        loaded_at_field: _extracted_at
```

If Bronze data is older than 1 hour, `dbt source freshness` warns. This is how we detect Dagster failures.

### Jinja templating

dbt models are SQL + Jinja. Jinja is a Python templating language. In dbt, it's used for:

```sql
-- Using a variable
WHERE transaction_date >= '{{ var("start_date", "2024-01-01") }}'

-- Using a macro (reusable SQL snippet)
{{ generate_surrogate_key(['user_id', 'category_id', 'month']) }}

-- Conditional logic
{% if target.name == 'dev' %}
  LIMIT 1000
{% endif %}
```

Macros live in `macros/*.sql` and are like functions. The `dbt_utils` package provides common macros.

### Packages

dbt has a package ecosystem (like npm for SQL). Common packages:

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
```

Install with `dbt deps`. `dbt_utils` provides:
- `generate_surrogate_key()` — consistent hashing for surrogate keys.
- `pivot()` — crosstab/pivot table macro.
- `accepted_range` — numeric range test.

---

## Our dbt project structure

```
data_platform/
├── dbt_project.yml         -- project config, materialization defaults
├── profiles.yml            -- warehouse connection (DuckDB / BigQuery)
├── packages.yml            -- dbt_utils, etc.
├── macros/
│   └── assert_positive_amount.sql
├── tests/
│   └── custom_tests.sql
└── models/
    ├── bronze/
    │   └── schema.yml      -- source definitions for raw_* tables
    ├── silver/
    │   ├── staging/
    │   │   ├── stg_transactions.sql
    │   │   ├── stg_shifts.sql
    │   │   ├── stg_budgets.sql
    │   │   ├── stg_categories.sql
    │   │   └── schema.yml
    │   └── intermediate/
    │       ├── int_shifts_with_duration.sql
    │       ├── int_transactions_enriched.sql
    │       └── schema.yml
    └── gold/
        ├── fct_transactions.sql
        ├── dim_categories.sql
        ├── mart_monthly_spend.sql
        ├── mart_budget_vs_actual.sql
        ├── mart_earnings_summary.sql
        ├── mart_cashflow.sql
        ├── mart_pay_cycle.sql
        └── schema.yml
```

### `dbt_project.yml`

```yaml
name: budjet
version: '1.0.0'
profile: budjet           # matches profiles.yml

model-paths: ["models"]
macro-paths: ["macros"]
test-paths:  ["tests"]

models:
  budjet:
    silver:
      staging:
        +materialized: view
        +schema: silver
      intermediate:
        +materialized: view
        +schema: silver
    gold:
      +materialized: table
      +schema: gold
```

### `profiles.yml`

```yaml
budjet:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: "{{ env_var('DUCKDB_PATH', 'data_platform/budjet.duckdb') }}"

    cloud-demo:
      type: bigquery
      method: oauth
      project: budjet-demo-project
      dataset: budjet_gold
      threads: 4
```

Running `dbt run` uses `dev` (DuckDB). Running `dbt run --target cloud-demo` uses BigQuery. Same SQL, different warehouse.

---

## Common dbt commands

```bash
dbt debug          # verify connection works
dbt deps           # install packages from packages.yml
dbt run            # build all models
dbt run -s gold    # build only gold layer models
dbt test           # run all schema tests
dbt test -s mart_monthly_spend   # test one model
dbt docs generate  # build docs site
dbt docs serve     # open docs in browser (shows lineage graph)
dbt source freshness  # check Bronze data age
```

---

## The lineage graph

`dbt docs serve` opens a web UI showing every model and its dependencies:

```
raw_transactions (source)
    └── stg_transactions (silver)
            ├── int_transactions_enriched (silver)
            │       └── fct_transactions (gold)
            │               ├── mart_monthly_spend (gold)
            │               ├── mart_budget_vs_actual (gold)
            │               └── mart_cashflow (gold)
            └── (also feeds mart_cashflow directly)

raw_categories (source)
    └── stg_categories (silver)
            └── dim_categories (gold)
                    └── mart_monthly_spend (gold)
```

This is one of dbt's biggest selling points for a portfolio project — a visual lineage diagram that shows data flow at a glance.

---

## Why dbt over raw SQL scripts

| Without dbt | With dbt |
|-------------|----------|
| SQL scripts run in undefined order | Dependency resolution, correct order guaranteed |
| No tests — trust manually | Built-in tests, failing test = failing CI |
| No documentation — knowledge in your head | Column descriptions in `.yml`, auto-generated docs site |
| SQL files on a drive somewhere | Git-versioned, PR-reviewed transforms |
| Warehouse-specific syntax | `ref()` and `source()` abstract the target |
| Run them — how? Cron? Manually? | dbt is designed to be invoked by an orchestrator (Dagster) |

---

## Common interview questions

**Q: What is dbt and what problem does it solve?**
A: dbt is a SQL transformation framework that brings software engineering practices (version control, testing, documentation, modularity) to analytical SQL. Without dbt, SQL transforms are typically bespoke scripts with no tests, no lineage, and no way to know what ran in what order. dbt solves this by defining models as SQL SELECT statements, resolving their dependencies into a DAG, and running them in order, with tests at each layer.

**Q: What is the difference between `ref()` and `source()`?**
A: `source()` references raw tables outside dbt's management — data loaded by Dagster, for example. `ref()` references another dbt model. The distinction matters because dbt tracks lineage through `ref()` — it builds the dependency graph from it. `source()` marks the boundary of what dbt owns.

**Q: What is a dbt materialization? When would you use `incremental` vs `table`?**
A: Materialization controls how dbt writes model output to the warehouse. `table` drops and re-creates the table on every `dbt run` — simple but rebuilds from scratch. `incremental` only processes new or changed rows, appending them to the existing table. Use `incremental` for large fact tables where a full rebuild is too slow; use `table` for Gold marts where data volume is manageable and correctness is paramount.

**Q: How do dbt tests work?**
A: dbt tests are SQL assertions. Built-in tests (`not_null`, `unique`, `accepted_values`) are declared in `.yml` files. For each test, dbt generates a SQL query that should return 0 rows if the test passes (e.g., `SELECT * FROM model WHERE column IS NULL`). Custom tests are SQL files that should also return 0 rows. `dbt test` runs all tests and fails if any return rows.

**Q: How does dbt handle multiple warehouses (DuckDB locally, BigQuery in cloud)?**
A: Via `profiles.yml`, which defines multiple targets with different warehouse connections. Models use `ref()` and `source()` instead of hardcoded table names, so dbt resolves the correct fully-qualified name for whichever target is active. The same SQL runs on either warehouse by switching `--target`.
