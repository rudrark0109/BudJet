# BudJet OLAP Journey — Project Context

> Start here. This document explains what we built first, why it wasn't enough, and what we're building next. Every other study doc builds on this narrative.

---

## What we built (OLTP layer)

BudJet started as a classic three-tier web app:

```
React (Vite) → Express (Node.js) → PostgreSQL
```

Six REST resources: `users`, `categories`, `transactions`, `budgets`, `jobs`, `shifts`.

Firebase handles authentication. Every user action — log a transaction, clock in to a shift, set a budget — is an `INSERT` or `UPDATE` against Postgres. This is the **write path**, and it works well for what it does.

The `transactions.js` route already does some analytics: totals, category breakdown, a monthly trend array, a pay-cycle savings estimate. These are written as raw SQL window functions directly inside the route handler. They work for a single user at low data volumes. They will not scale, they are hard to test, and they mix concerns (serving HTTP vs. computing business metrics).

---

## Why OLTP alone is not enough

OLTP databases (Postgres, MySQL) are designed to answer questions like:
- "What are this user's transactions from last month?" — one user, one table, small result set.
- "Insert this shift record." — low-latency write, ACID guarantee.

They are **row-oriented**: data is stored row-by-row on disk. Reading a single row is fast. Scanning millions of rows across many columns to compute aggregates is slow.

Analytics questions are different in shape:
- "How does my spend-per-category trend over 12 months?" — scans every row in `transactions`, groups by category and month, computes sums.
- "Which month had the highest burn rate deviation from the average?" — requires computing a rolling average, comparing each month's total.
- "Across all users, which categories are most commonly over-budget?" — full table scan, aggregation, comparison against a separate `budgets` table.

These are **OLAP workloads** (Online Analytical Processing). They are read-heavy, aggregate-heavy, and scan wide slices of data. They belong on an analytics stack designed for exactly that.

---

## The two systems, side by side

| Dimension | OLTP (what we have) | OLAP (what we're building) |
|-----------|--------------------|-----------------------------|
| Workload | Many small reads + writes | Few large reads, aggregations |
| Latency goal | Milliseconds per operation | Seconds per query is fine |
| Storage layout | Row-oriented | Column-oriented |
| Normalization | High (3NF, foreign keys) | Denormalized (star schema) |
| Freshness | Real-time | Batch (minutes to hours lag) |
| Optimization | Index on PK/FK, small result sets | Columnar scan, vectorized execution |
| System of record | Yes — source of truth | No — derived from OLTP |
| Our tech | PostgreSQL + Express | DuckDB + dbt + Dagster |

---

## The medallion lakehouse pattern

We are building a **data lakehouse** using the **medallion architecture**. The word "medallion" is just a metaphor for quality tiers — like bronze, silver, gold medals:

```
Postgres (OLTP)
    ↓  [Dagster extract]
Bronze  — raw copy of OLTP data, nothing changed, immutable
    ↓  [dbt transforms]
Silver  — cleaned, typed, deduped, business-rule-applied
    ↓  [dbt transforms]
Gold    — analytics-ready aggregates, facts, dimensions, marts
    ↓  [Express API reads Gold]
React /insights page
```

Each layer has a clear contract:
- **Bronze**: "This is exactly what Postgres had at extraction time."
- **Silver**: "This is correct, clean, typed data."
- **Gold**: "This answers a specific business question."

The separation means bugs are isolated. If Gold numbers are wrong, the cause is either in the Silver→Gold transform (a dbt model) or in the Silver data itself. Bronze is always auditable — it's the raw source truth, never modified.

---

## Technology choices at a glance

| Technology | Role | Why chosen |
|------------|------|-----------|
| **DuckDB** | Local analytics warehouse | In-process, zero infrastructure, columnar, fast OLAP queries, reads Parquet natively |
| **dbt** | SQL transformation framework | Version-controlled SQL, built-in testing, lineage graph, portable across warehouses |
| **Dagster** | Orchestration | Asset-oriented (not task-oriented), local dev is `dagster dev`, excellent UI for lineage |
| **Parquet** | Bronze storage format | Columnar, compressed, immutable, language-agnostic |

Each technology gets its own study document in this folder. Read them in order after this one.

---

## What "Phase 4" means in our workflow

Phases 0–3 were OLTP work: auth middleware, schema expansion (adding `shifts`, `jobs`), route cleanup.

**Phase 4 onwards is OLAP.** We are now:
1. Creating the `data_platform/` directory with a dbt project scaffold.
2. Setting up DuckDB as the local analytics warehouse.
3. Writing Dagster assets to extract from Postgres into Bronze Parquet files.
4. Writing dbt Silver models to clean the Bronze data.
5. Writing dbt Gold models (marts) that answer specific business questions.
6. Adding `/api/analytics/*` Express routes that read from Gold.
7. Building the React `/insights` page that renders those analytics.

Each step in this folder gets a study document. The documents explain not just *how* we do it, but *why*, and what an interviewer would ask about the decision.

---

## Interview-ready summary

**Q: Why split the app into OLTP + OLAP instead of just adding more SQL queries to Postgres?**

A: Two reasons. First, analytical queries (full-table scans, multi-table aggregates, window functions across large result sets) are fundamentally different in shape from transactional queries. Running them on the same database creates resource contention — a slow analytical query can block transactional writes. Second, the separation enforces clean data modeling: dbt's tested, version-controlled SQL transforms become the canonical definition of business metrics, rather than bespoke SQL buried in route handlers. This makes metrics auditable, testable, and easy to change.

**Q: Isn't DuckDB overkill for a personal finance app?**

A: For production traffic, yes — the data volume is small. The point of this architecture is the engineering demonstration: same pattern used at companies like Airbnb (Hive/Spark), Shopify (Trino), and modern data-first startups (DuckDB/dbt). DuckDB specifically is chosen because it requires zero infrastructure — no server, no daemon — so the full pipeline runs on a laptop. When you swap `profiles.yml` to point at BigQuery, the same dbt SQL runs at scale in the cloud. That portability is the whole point.
