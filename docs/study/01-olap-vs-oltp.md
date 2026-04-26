# OLAP vs OLTP — Deep Dive

> This is one of the most common data engineering interview topics. Understand it conceptually, not just as a definition.

---

## The fundamental difference: what questions do you need to answer?

**OLTP** (Online Transaction Processing) systems are built to serve the application. Every user action — submit a form, click a button, process a payment — is a transaction. The system needs to:
- Complete quickly (single-digit milliseconds).
- Be correct under concurrent writes (ACID guarantees).
- Retrieve individual rows efficiently (indexed lookups).

**OLAP** (Online Analytical Processing) systems are built to serve analytics. Data analysts and downstream consumers ask aggregate questions across large historical datasets. The system needs to:
- Scan large volumes of data quickly.
- Compute aggregates (SUM, COUNT, AVG, window functions) efficiently.
- Support complex joins across wide, denormalized tables.

---

## Storage layout: why it matters

This is the most important technical distinction.

### Row-oriented storage (OLTP — Postgres)

Data is stored row by row on disk:
```
Row 1: [txn_id=1, user_id=42, amount=50.00, category="Food", date=2024-01-01, description="Lunch"]
Row 2: [txn_id=2, user_id=42, amount=120.00, category="Rent", date=2024-01-01, description="Jan rent"]
Row 3: [txn_id=3, user_id=99, amount=35.00, category="Food", date=2024-01-02, description="Groceries"]
```

Fetching one complete transaction (Row 1) is fast — the whole row is stored contiguously. Writing a new row appends to the end. This is perfect for OLTP.

But to answer "what is the total spend per category?" the database must read **every row** and pick out just the `amount` and `category` columns. It reads data it doesn't need (user_id, date, description) just to get to the columns it does.

### Column-oriented storage (OLAP — DuckDB, BigQuery, Redshift)

Data is stored column by column:
```
txn_id column:     [1, 2, 3, 4, 5, ...]
user_id column:    [42, 42, 99, 42, 99, ...]
amount column:     [50.00, 120.00, 35.00, 88.00, 12.00, ...]
category column:   ["Food", "Rent", "Food", "Utilities", "Food", ...]
```

To answer "total spend per category", the database reads **only** the `amount` and `category` columns. It skips everything else. For a table with 20 columns, this can be 20x less I/O.

Additionally, columnar storage compresses extremely well: a column of repeated category strings like `["Food", "Food", "Food", "Rent", "Food"]` compresses to almost nothing with dictionary encoding.

---

## ACID vs eventual consistency

**OLTP databases** guarantee ACID:
- **Atomicity**: a transaction either fully completes or fully rolls back.
- **Consistency**: constraints (foreign keys, NOT NULL) are always enforced.
- **Isolation**: concurrent transactions don't see each other's partial state.
- **Durability**: once committed, data survives crashes.

This is essential when a user submits a payment — you cannot have "half a payment" written.

**OLAP systems** often trade strict ACID for throughput. DuckDB supports full ACID for single-writer scenarios (which is our case). BigQuery uses optimistic concurrency. These systems are rarely the source of record, so strict ACID on writes matters less than read performance.

---

## Normalization vs denormalization

### Normalized (OLTP — 3NF)

Postgres schema stores categories in a separate table:
```sql
transactions (id, user_id, category_id, amount, ...)
categories   (id, user_id, name, color, type)
```

This avoids duplication: the category name `"Food"` is stored once, and every transaction references it by `category_id`. Updates are efficient — change the category name in one place. Storage is compact.

The downside for analytics: to get a transaction with its category name, you must `JOIN`. Joins across large tables are expensive.

### Denormalized (OLAP — star schema)

The `fct_transactions` Gold mart in DuckDB:
```sql
fct_transactions (txn_id, user_id, amount, category_name, category_type, color, ...)
```

The category name is **repeated** in every transaction row. This wastes some storage, but analytical queries never need a JOIN to get category information. Aggregations are faster because everything is in one wide table.

This is the **star schema** pattern: a central fact table surrounded by dimension tables (or pre-joined into the fact table for small dimensions).

---

## Read vs write optimization

| | OLTP (Postgres) | OLAP (DuckDB) |
|--|-----------------|----------------|
| Index type | B-tree on PK/FK | Columnar min/max zone maps |
| Write throughput | High (designed for it) | Lower (batch-oriented) |
| Read throughput | Fast for single rows | Fast for aggregate scans |
| Concurrency | Many concurrent writers | Few readers, rare writers |
| Partitioning | Manual, by range/hash | Native partition pruning |
| Compression | Per-row (minimal benefit) | Per-column (huge benefit) |

---

## Where our data flows

```
User enters transaction
        ↓
  Express API (OLTP write)
        ↓
  Postgres INSERT
        ↓   [15-minute Dagster extract]
  Bronze Parquet file
  (raw copy, immutable)
        ↓   [dbt run]
  Silver DuckDB views
  (cleaned, typed)
        ↓   [dbt run]
  Gold DuckDB tables
  (fct_transactions, mart_monthly_spend, ...)
        ↓   [Express reads]
  /api/analytics/* JSON response
        ↓
  React /insights Recharts
```

Postgres owns the write path and is the system of record. DuckDB owns the read path for analytics. The two never talk directly — Dagster moves data between them.

---

## Latency tradeoffs

Our analytics data is **15 minutes stale by design**. A user adds a transaction; it appears in the OLTP dashboard immediately (Postgres read). It appears in the analytics insights after the next Dagster run.

This is an intentional tradeoff. The alternative (real-time OLAP with CDC streaming into DuckDB) adds complexity — Kafka, Debezium, stream processing. For a personal finance app where users review monthly trends, 15-minute lag is irrelevant.

**Interview framing**: "We made a conscious decision to use batch extraction with a 15-minute schedule instead of real-time streaming. The data freshness requirement for analytics (monthly trends, budget comparisons) does not justify the operational overhead of a streaming pipeline."

---

## Common interview questions

**Q: What is OLAP?**
A: Online Analytical Processing — a category of database workloads characterized by large aggregate reads over historical data, as opposed to OLTP which is optimized for low-latency individual row reads and writes.

**Q: Why is columnar storage faster for analytics?**
A: Analytics queries typically aggregate a few columns across many rows. Columnar storage means the database reads only the columns referenced in the query, skipping irrelevant data. It also enables better compression (similar values in a column compress well), and vectorized CPU operations on continuous memory blocks.

**Q: What is a data warehouse vs a data lake vs a data lakehouse?**
- **Data lake**: raw files on object storage (S3, GCS). No schema enforcement, cheap storage, hard to query fast.
- **Data warehouse**: structured, schema-on-write, optimized for SQL queries (BigQuery, Redshift, Snowflake). Expensive, limited to SQL.
- **Data lakehouse**: combines both. Files stored as open formats (Parquet, Delta, Iceberg) with a query engine (DuckDB, Trino, Spark) that treats them as a warehouse. We use this pattern: Parquet files (lake) queried by DuckDB (warehouse).

**Q: When would you NOT split into OLTP + OLAP?**
A: If the analytical queries are simple, data volume is small, and team capacity is limited, adding an analytics pipeline introduces operational overhead that may not pay off. The breakpoint is roughly: when analytical queries start degrading OLTP response times, or when business logic in SQL transforms becomes complex enough to need version control and testing.
