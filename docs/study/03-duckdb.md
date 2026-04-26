# DuckDB — The Analytics Warehouse

> DuckDB is our local analytics warehouse. It plays the same role as BigQuery or Snowflake, but runs in-process with zero infrastructure.

---

## What is DuckDB?

DuckDB is an **embeddable, in-process, columnar SQL database** designed for analytical (OLAP) workloads. Think of it like SQLite, but for analytics instead of transactions.

Key characteristics:
- **In-process**: runs as a library inside your application, no separate server.
- **Columnar**: stores data column-by-column (like BigQuery, Redshift) for fast aggregations.
- **Vectorized execution**: processes data in batches (vectors) using SIMD CPU instructions.
- **SQL-compatible**: standard SQL with many analytical extensions (window functions, ASOF joins, PIVOT).
- **Reads files natively**: can query Parquet, CSV, JSON, and Arrow directly without importing.

---

## Why DuckDB instead of Postgres for analytics

Postgres is a row-oriented OLTP database. Running analytical queries on Postgres works, but:
1. It competes for resources with transactional writes (the app).
2. It cannot do columnar scans — it reads entire rows even when you only need two columns.
3. It lacks the analytical SQL extensions (PIVOT, ASOF JOIN, native Parquet reading).

We use **Postgres for writes, DuckDB for reads**. They serve different workloads.

---

## Why DuckDB instead of BigQuery/Snowflake

BigQuery and Snowflake are cloud data warehouses. They are operationally heavy:
- Require cloud accounts and credentials.
- Cost money per query.
- Cannot run offline.
- Need network access.

DuckDB runs on your laptop. Our `data_platform/budjet.duckdb` file is the entire analytics warehouse — one file, no daemons, no cloud billing.

The catch is scale: DuckDB on a laptop handles data up to ~100GB comfortably. For a personal finance app with one user's transactions, the dataset is kilobytes. DuckDB is wildly over-qualified, which is exactly what makes it a perfect teaching tool.

When we want to show cloud scalability, the same dbt SQL runs against BigQuery by switching `profiles.yml`. That's the demo story.

---

## Core concepts

### The DuckDB file

```
data_platform/budjet.duckdb
```

This single file IS the analytics warehouse. It contains:
- The tables Dagster creates for Bronze raw data.
- The views dbt creates for Silver staging/intermediate models.
- The tables dbt creates for Gold mart models.

You can open it with the DuckDB CLI, Python (`import duckdb`), or the `duckdb` npm package in Node.js (our Express analytics routes use this).

### Columnar storage internals

DuckDB stores each column in its own compressed block. For our `mart_monthly_spend` table:

```
user_id column:        [compressed repeated strings]
category_name column:  [dictionary-encoded strings]
month column:          [delta-encoded dates]
total_amount column:   [floating-point values]
```

A query like `SELECT category_name, SUM(total_amount) WHERE user_id = 'abc'` reads:
- The `user_id` column to find matching rows.
- The `category_name` column for those rows.
- The `total_amount` column for those rows.

It skips `month`, `transaction_count`, and any other columns entirely. On a wide table with many columns, this is a significant speedup.

### Vectorized execution

Traditional row-at-a-time execution processes one row, then the next, then the next. Vectorized execution processes a **batch (vector) of 1024 rows** at a time. This maps to how modern CPUs work — SIMD instructions can operate on 8 or 16 values simultaneously.

For `SUM(total_amount)`, vectorized execution loads 1024 amounts into a CPU register and adds them all in a few instructions, rather than adding them one at a time in a loop. This is why DuckDB benchmarks comparably to cloud warehouses on single-machine data.

### Native Parquet reading

DuckDB can query Parquet files as if they were tables:

```sql
SELECT *
FROM read_parquet('storage/bronze/raw_transactions/**/*.parquet')
WHERE transaction_date >= '2024-01-01';
```

DuckDB understands Parquet's columnar structure and applies **predicate pushdown**: when you filter on `transaction_date`, DuckDB only reads Parquet row groups that might contain matching dates (using min/max statistics stored in the Parquet footer). It can skip entire files without reading them.

This is how our Bronze layer works: Parquet files on disk, DuckDB reads them directly.

---

## How we use DuckDB in BudJet

### In Dagster (Python)

Dagster uses the `duckdb` Python package to:
1. Register Bronze Parquet files as DuckDB tables (`raw_transactions`, `raw_shifts`, etc.).
2. Write the initial Bronze layer metadata into DuckDB.

```python
import duckdb

conn = duckdb.connect("data_platform/budjet.duckdb")
conn.execute("""
    CREATE OR REPLACE TABLE raw_transactions AS
    SELECT * FROM read_parquet('storage/bronze/raw_transactions/**/*.parquet')
""")
```

### In dbt (SQL profiles)

dbt uses the `dbt-duckdb` adapter. When you run `dbt run`, it:
- Connects to `budjet.duckdb`.
- Executes each model's SQL.
- Writes the result as a view (Silver) or table (Gold) in DuckDB.

`profiles.yml`:
```yaml
budjet:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: "data_platform/budjet.duckdb"
    cloud-demo:
      type: bigquery
      project: budjet-demo
      dataset: budjet_gold
      ...
```

Same dbt models, two targets — local DuckDB or cloud BigQuery. Swap with `dbt run --target cloud-demo`.

### In Express (Node.js analytics API)

The `/api/analytics/*` routes use the `duckdb` npm package to query Gold tables:

```javascript
const duckdb = require('duckdb');
const db = new duckdb.Database('data_platform/budjet.duckdb', { access_mode: 'READ_ONLY' });

// GET /api/analytics/monthly-spend/:userId
app.get('/api/analytics/monthly-spend/:userId', verifyFirebaseToken, (req, res) => {
    db.all(`
        SELECT month, category_name, total_amount
        FROM mart_monthly_spend
        WHERE user_id = ?
        ORDER BY month DESC
    `, [req.params.userId], (err, rows) => {
        res.json(rows);
    });
});
```

Note `READ_ONLY` mode: the Express server never writes to DuckDB. Only Dagster+dbt write. This prevents corruption from concurrent writes.

---

## DuckDB vs SQLite

Both are embedded, file-based databases. The difference is their design target:

| | SQLite | DuckDB |
|--|--------|--------|
| Design target | OLTP (small reads/writes) | OLAP (large aggregations) |
| Storage | Row-oriented | Columnar |
| Concurrency | Write lock on the file | MVCC for reads, single writer |
| Analytical SQL | Limited | Full: window functions, PIVOT, ASOF JOIN |
| Performance on aggregates | Slow | Fast (vectorized) |
| Parquet/Arrow support | No | Native |
| Use case | Mobile apps, embedded config | Analytics pipelines, data science |

---

## DuckDB in production (beyond this project)

DuckDB is increasingly used in production at real companies:

- **MotherDuck**: cloud-hosted DuckDB (DuckDB as a service).
- **Evidence**: BI tool that runs dbt + DuckDB in the browser.
- **Rill**: data dashboard tool built on DuckDB.
- Many data science teams use DuckDB to replace Spark for medium-scale data processing.

The DuckDB project is from CWI Amsterdam and is actively maintained as open source.

---

## Common interview questions

**Q: What is DuckDB and how does it differ from Postgres?**
A: DuckDB is an in-process columnar analytical database. Postgres is a server-based row-oriented transactional database. DuckDB is optimized for analytical queries (aggregations, full-column scans) while Postgres is optimized for transactional workloads (single-row reads/writes with ACID guarantees). DuckDB requires no server or infrastructure — it runs as a library and stores data in a single file.

**Q: What is vectorized execution?**
A: Instead of processing one row at a time, vectorized execution processes batches of rows (vectors, typically 1024 rows) in a single CPU instruction cycle. Modern CPUs have SIMD instructions that can perform the same operation on multiple values simultaneously. Vectorized execution maps directly to these instructions, making aggregation operations dramatically faster than row-at-a-time processing.

**Q: How does DuckDB read Parquet files efficiently?**
A: DuckDB uses **predicate pushdown** and **projection pushdown**. Parquet files store column min/max statistics in row group footers. When a query has a WHERE clause, DuckDB reads the statistics first and skips row groups that cannot contain matching rows. When a query only references certain columns, DuckDB reads only those columns' byte ranges in the file. This means DuckDB can sometimes answer a query without reading most of the file.

**Q: Can DuckDB handle multiple concurrent readers?**
A: Yes. DuckDB uses MVCC (Multi-Version Concurrency Control) for reads, similar to Postgres. Multiple processes can read the same DuckDB file simultaneously. However, only one process can write at a time. In our architecture, we enforce this by opening the file in `READ_ONLY` mode in Express, and only allowing Dagster+dbt to write.

**Q: Why use DuckDB instead of just running analytics queries directly on Postgres?**
A: Two reasons. First, analytical queries (full-table scans, large aggregations) compete with transactional queries for Postgres resources — a slow analytics query can delay user-facing writes. Second, DuckDB's columnar storage and vectorized execution make analytics queries significantly faster. The separation also enforces a clean architecture: Postgres is the system of record, DuckDB is the analytics cache.
