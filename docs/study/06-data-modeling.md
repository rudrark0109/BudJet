# Data Modeling — Star Schema, Facts, and Dimensions

> Understanding star schema is fundamental to data engineering interviews. This explains the data modeling concepts behind our Gold layer.

---

## Why data modeling matters in OLAP

The OLTP schema is **normalized** (3NF) to minimize data duplication and support efficient writes. The OLAP schema is **denormalized** to maximize query performance for aggregations and analytics.

Choosing the right shape for your analytical data model is as important as choosing the right tools. A poorly modeled Gold layer means every consumer must figure out the same joins and business logic themselves.

---

## Normalization vs denormalization

### Normalized (3NF) — our Postgres schema

```
transactions: (id, user_id, category_id, amount, type, date)
categories:   (id, user_id, name, color, type)
```

To get "transactions with category name", you need:
```sql
SELECT t.amount, c.name AS category_name
FROM transactions t
JOIN categories c ON t.category_id = c.id
```

This join is fine for one user's 100 transactions. It becomes expensive at scale.

### Denormalized — our Gold `fct_transactions`

```
fct_transactions: (txn_id, user_id, amount, type,
                   category_id, category_name, category_color, category_type,
                   transaction_date, month, year)
```

The category name and color are **repeated** in every row. Storage cost is small (these are short strings). The benefit is that consumers never need to join to `categories` — it's already there.

---

## Star schema

The **star schema** is the dominant pattern for OLAP data models. It has:
- **One central fact table**: measurable events.
- **Multiple dimension tables** surrounding it: descriptive context.

Drawn as a diagram, it looks like a star:

```
         dim_categories
               |
               |
dim_users -- fct_transactions -- dim_date
               |
               |
           dim_jobs
```

### Fact table

A fact table records **business events** (things that happened). Each row is one occurrence of the event.

Our `fct_transactions`:
- One row per transaction.
- Contains **measures** (numeric values that can be aggregated): `amount`.
- Contains **foreign keys** to dimension tables: `user_id`, `category_id`.
- Contains **degenerate dimensions** (attributes that don't warrant a separate table): `transaction_type` ('income'/'expense'), `description`.
- Contains **date keys**: `transaction_date`, `month` (derived).

Fact tables are wide (many columns) and tall (many rows). They grow forever as new events occur.

### Dimension table

A dimension table provides **descriptive context** about the entities in facts.

Our `dim_categories`:
- One row per category per user.
- Contains **attributes**: `category_name`, `category_color`, `category_type`.
- Is relatively small and changes infrequently (users rarely rename categories).

Dimension tables are wide (many attribute columns) and relatively short (bounded by the number of distinct entities).

---

## Grain

**Grain** is the most important concept in fact table design. It defines what one row represents.

Before writing a single column, answer: "One row in this table represents _____."

| Table | Grain |
|-------|-------|
| `fct_transactions` | One transaction event |
| `mart_monthly_spend` | One category × one month × one user |
| `mart_budget_vs_actual` | One budget period × one category × one user |
| `mart_cashflow` | One month × one user |
| `mart_pay_cycle` | One pay cycle × one user |

Getting the grain wrong causes double-counting bugs — a classic data modeling error. If `mart_monthly_spend` accidentally has two rows for (user, "Food", "2024-01") — one from one branch of logic and one from another — every SUM over it will double-count Food spending for that user.

dbt's `unique` test on the grain columns catches this automatically.

---

## Our Gold models in detail

### `fct_transactions`

**Grain**: one transaction.

```sql
SELECT
    t.transaction_id,
    t.user_id,
    t.amount,
    t.transaction_type,         -- 'income' | 'expense'
    t.category_id,
    c.category_name,            -- denormalized from dim_categories
    c.category_type,
    c.color,
    t.transaction_date,
    DATE_TRUNC('month', t.transaction_date) AS month,
    EXTRACT('year' FROM t.transaction_date) AS year
FROM {{ ref('stg_transactions') }} t
LEFT JOIN {{ ref('dim_categories') }} c
    ON t.category_id = c.category_id
   AND t.user_id    = c.user_id
```

This is the **base fact table**. Other Gold models aggregate from this.

### `mart_monthly_spend`

**Grain**: user × category × month.

```sql
SELECT
    user_id,
    category_name,
    category_type,
    color,
    month,
    SUM(amount)   AS total_amount,
    COUNT(*)      AS transaction_count,
    AVG(amount)   AS avg_transaction_amount
FROM {{ ref('fct_transactions') }}
WHERE transaction_type = 'expense'
GROUP BY 1, 2, 3, 4, 5
```

Powers the category donut chart and the monthly trend bar chart in React.

### `mart_budget_vs_actual`

**Grain**: user × category × month.

```sql
SELECT
    a.user_id,
    a.category_name,
    a.month,
    a.total_amount          AS actual_spend,
    b.budget_amount,
    b.budget_amount - a.total_amount  AS remaining,
    CASE
        WHEN b.budget_amount IS NULL THEN 'no_budget'
        WHEN a.total_amount > b.budget_amount THEN 'over'
        WHEN a.total_amount > b.budget_amount * 0.8 THEN 'warning'
        ELSE 'ok'
    END AS budget_status
FROM {{ ref('mart_monthly_spend') }} a
LEFT JOIN {{ ref('stg_budgets') }} b
    ON  a.user_id      = b.user_id
    AND a.category_name = b.category_name
    AND a.month        = DATE_TRUNC('month', b.month::DATE)
```

Powers the "am I over budget?" cards in React.

### `mart_cashflow`

**Grain**: user × month.

```sql
SELECT
    user_id,
    month,
    SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
    SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END)
  - SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS net_cashflow
FROM {{ ref('fct_transactions') }}
GROUP BY 1, 2
ORDER BY 1, 2
```

Powers the top-line income vs. expense chart.

### `mart_earnings_summary`

**Grain**: user × employer × month.

```sql
SELECT
    s.user_id,
    j.employer,
    j.position,
    DATE_TRUNC('month', s.shift_date) AS month,
    COUNT(*)                           AS shifts_worked,
    SUM(s.hours_worked)                AS total_hours,
    SUM(s.gross_pay)                   AS total_gross_pay,
    SUM(s.tip_amount)                  AS total_tips,
    AVG(j.hourly_rate)                 AS avg_hourly_rate
FROM {{ ref('int_shifts_with_duration') }} s
JOIN {{ ref('stg_jobs') }} j ON s.job_id = j.job_id
GROUP BY 1, 2, 3, 4
```

Powers the earnings KPI card.

---

## Surrogate keys

A **surrogate key** is a system-generated primary key, independent of the source data. It's a best practice in OLAP models.

Why: source systems sometimes change natural keys (user renames a category — now the natural key "Food" changes to "Groceries"). A surrogate key is stable.

Generated with `dbt_utils.generate_surrogate_key()`:
```sql
{{ dbt_utils.generate_surrogate_key(['user_id', 'category_name', 'month']) }}
AS mart_id
```

This creates a consistent MD5 hash from the grain columns, usable as a stable PK.

---

## Slowly Changing Dimensions (SCD)

A **Slowly Changing Dimension** is a dimension table that changes over time. For example, a user renames "Food" to "Dining Out".

**SCD Type 1**: overwrite — the old name is gone. Simple but loses history.

**SCD Type 2**: add a new row with an effective date. Old rows get `valid_to` set, new rows get `valid_from = today`. Queries can ask "what was the category name in January?".

For BudJet, we use SCD Type 1 for simplicity — if a user renames a category, historical transactions display under the new name. This is a known tradeoff, documented in our ADR.

---

## Common interview questions

**Q: What is a star schema?**
A: A data model with one central fact table (measurable events) surrounded by dimension tables (descriptive context). The fact table contains foreign keys to dimension tables and numeric measures. This structure optimizes analytical queries — aggregating facts is fast because the fact table is denormalized and dimension lookups are simple PK joins.

**Q: What is grain in data modeling?**
A: Grain is the definition of what one row in a table represents. It must be decided before adding any columns. "One row per transaction", "one row per user per month per category." Getting grain right prevents double-counting bugs. It should be declared in the table's dbt `.yml` documentation and enforced with a `unique` test on the grain columns.

**Q: What is the difference between a fact table and a mart?**
A: A fact table (`fct_transactions`) is at the raw event grain — one row per event. A mart (`mart_monthly_spend`) is pre-aggregated to a specific business grain (user × category × month). Facts are atomic; marts answer specific business questions. The pattern: build atomic fact tables first, derive marts from them.

**Q: What is a Slowly Changing Dimension?**
A: A dimension that changes over time (a customer moves, a product is renamed). SCD Type 1 overwrites the old value (simple, loses history). SCD Type 2 adds a new row with validity dates (complex, preserves full history). Most analytical models use Type 1 for simplicity unless historical dimension tracking is a business requirement.

**Q: Why is denormalization used in OLAP but not OLTP?**
A: Denormalization trades storage space for query speed. In OLTP, normalization reduces write overhead — updating one canonical value is efficient. In OLAP, queries scan millions of rows for aggregations — eliminating joins by pre-joining dimension attributes into the fact table speeds up queries significantly, and storage is cheap (especially compressed columnar storage).
