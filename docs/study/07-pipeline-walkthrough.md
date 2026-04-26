# End-to-End Pipeline Walkthrough

> A concrete trace of one transaction from user input to analytics chart. Use this to explain the entire system in an interview.

---

## The scenario

Rudra opens BudJet, enters a $47.50 transaction: "Lunch", category "Food", date today.

Trace what happens technically from React to DuckDB and back.

---

## Step 1: React sends a POST request

`frontend/src/api/transactions.js` calls:
```javascript
POST /api/transactions
Authorization: Bearer <Firebase ID token>
Body: {
  uid: "abc123",
  amount: 47.50,
  type: "expense",
  category_id: 7,
  description: "Lunch",
  transaction_date: "2024-04-26"
}
```

Firebase ID token is a JWT signed by Firebase. It contains the user's UID and email, and expires in 1 hour.

---

## Step 2: Express verifies the token

`backend/src/middleware/firebaseAuth.js` runs `verifyFirebaseToken`:
1. Extracts `Bearer <token>` from the `Authorization` header.
2. Either uses `firebase-admin.auth().verifyIdToken(token)` (if service account configured) or calls Firebase REST `accounts:lookup` endpoint.
3. Attaches `req.user = { uid: "abc123", email: "..." }` to the request.
4. Calls `next()`.

If the token is invalid or expired, returns HTTP 401.

---

## Step 3: Postgres INSERT

`backend/src/routes/transactions.js`:
```sql
INSERT INTO transactions (user_id, category_id, amount, type, description, transaction_date)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;
```

Postgres writes the row. ACID guarantees: the row is either fully written or not written at all. Returns the new row with its generated `id`.

Express returns HTTP 201 with the new transaction to React.

The transaction is now **live in the OLTP app**. The React HomePage immediately shows it (it re-fetches the transaction list after the POST).

---

## Step 4: Dagster Bronze extraction (15 minutes later)

Dagster runs on a `*/15 * * * *` schedule. The `raw_transactions` asset executes:

```python
date = context.partition_key    # "2024-04-26"

df = pd.read_sql(
    """
    SELECT id, user_id, category_id, amount, type,
           description, transaction_date, created_at
    FROM transactions
    WHERE DATE(created_at) = %s
    """,
    postgres_conn,
    params=[date]
)

output_path = f"storage/bronze/raw_transactions/date={date}/transactions.parquet"
df.to_parquet(output_path, index=False)
```

The $47.50 Lunch transaction is now in `storage/bronze/raw_transactions/date=2024-04-26/transactions.parquet` as a Parquet row.

Dagster also runs `raw_categories`, `raw_shifts`, `raw_budgets` assets for today's partition.

After all Bronze assets succeed, Dagster triggers the dbt assets.

---

## Step 5: dbt Silver models

dbt runs `stg_transactions` (a view in DuckDB):

```sql
-- stg_transactions view
SELECT
    id::INTEGER             AS transaction_id,
    user_id,
    amount::DECIMAL(12,2)   AS amount,   -- "47.5" string → 47.50 decimal
    type                    AS transaction_type,
    category_id::INTEGER    AS category_id,
    transaction_date::DATE  AS transaction_date,
    created_at::TIMESTAMP   AS created_at
FROM read_parquet('storage/bronze/raw_transactions/**/*.parquet')
WHERE amount IS NOT NULL
  AND amount::DECIMAL > 0
  AND type IN ('income', 'expense')
```

This view always reads the latest Bronze Parquet files. No data is stored yet.

dbt runs Silver tests:
- `not_null` on `transaction_id`, `user_id`, `amount` → passes.
- `accepted_values` on `transaction_type` → 'expense' is valid.

---

## Step 6: dbt Gold models

dbt runs `fct_transactions` (a table in DuckDB):

```sql
CREATE TABLE main.fct_transactions AS
SELECT
    t.transaction_id,
    t.user_id,
    t.amount,
    t.transaction_type,
    t.category_id,
    c.category_name,    -- "Food" from stg_categories
    c.color,
    t.transaction_date,
    DATE_TRUNC('month', t.transaction_date) AS month
FROM stg_transactions t
LEFT JOIN dim_categories c
    ON t.category_id = c.category_id
   AND t.user_id    = c.user_id
```

The Lunch transaction is now in `fct_transactions` with `category_name = "Food"`.

dbt runs `mart_monthly_spend` (another table):
```sql
CREATE TABLE main.mart_monthly_spend AS
SELECT
    user_id,
    category_name,
    month,
    SUM(amount) AS total_amount,
    COUNT(*)    AS transaction_count
FROM fct_transactions
WHERE transaction_type = 'expense'
GROUP BY 1, 2, 3
```

The row for `(user_id="abc123", category_name="Food", month="2024-04-01")` now has `total_amount` that includes this $47.50 transaction.

dbt runs tests on Gold models — all pass.

---

## Step 7: Express analytics API reads Gold

Rudra navigates to `/insights` in React.

React calls:
```
GET /api/analytics/monthly-spend/abc123
Authorization: Bearer <Firebase ID token>
```

`backend/src/routes/analytics.js`:
```javascript
db.all(`
    SELECT category_name, color, month, total_amount, transaction_count
    FROM mart_monthly_spend
    WHERE user_id = ?
    ORDER BY month DESC, total_amount DESC
`, [userId], (err, rows) => {
    res.json(rows);
});
```

DuckDB reads `mart_monthly_spend` (a pre-aggregated table — instant). Returns JSON:
```json
[
  { "category_name": "Food", "month": "2024-04-01", "total_amount": 312.50, ... },
  { "category_name": "Rent", "month": "2024-04-01", "total_amount": 1200.00, ... },
  ...
]
```

---

## Step 8: React renders the chart

`frontend/src/pages/Insights.jsx` receives the JSON and renders a Recharts donut chart:
- "Food" slice: $312.50 (includes our $47.50 Lunch + earlier food transactions).
- "Rent" slice: $1200.00.

The Lunch transaction entered 15 minutes ago is now visible in the analytics chart.

---

## The complete data lineage

```
User types "$47.50, Food, Lunch"
    │
    ▼
React POST /api/transactions
    │
    ▼
Express firebaseAuth middleware → Postgres INSERT
    │
    ▼  [15 min later: Dagster schedule]
Bronze Parquet: storage/bronze/raw_transactions/date=2024-04-26/
    │
    ▼  [Dagster triggers dbt run]
Silver DuckDB view: stg_transactions (typed, validated)
    │
    ▼  [dbt run]
Silver DuckDB view: int_transactions_enriched (category joined)
    │
    ▼  [dbt run]
Gold DuckDB table: fct_transactions (base fact)
    │
    ▼  [dbt run]
Gold DuckDB table: mart_monthly_spend (user × category × month aggregate)
    │
    ▼  [User navigates to /insights]
Express GET /api/analytics/monthly-spend/:userId
    │
    ▼
React Recharts donut chart
```

---

## Failure modes and recovery

| Where failure occurs | Symptom | Recovery |
|----------------------|---------|----------|
| Postgres INSERT fails | 500 error in React, transaction not saved | Fix and re-submit (OLTP, user retries) |
| Dagster Bronze extraction fails | Analytics stale, Bronze has no today partition | Re-run the specific date partition from Dagster UI |
| dbt Silver test fails | dbt halts, Gold not refreshed | Fix Silver model or source data, re-run `dbt run` |
| dbt Gold test fails | dbt test reports failure, stale Gold | Investigate mart logic, fix, re-run |
| Express analytics route fails | Insights page shows error state | Check DuckDB file path, re-run dbt if tables missing |

Each failure is isolated. A dbt failure doesn't affect the OLTP app — transactions still work. Bronze failures don't corrupt existing Gold — they just don't update it.

---

## What to say in an interview

"Our pipeline extracts data from Postgres every 15 minutes using a Dagster asset, writes it as Parquet in a Bronze layer, runs dbt transforms to clean it in Silver and aggregate it in Gold, and serves the Gold tables through an Express API to the React frontend. The write path and read path are completely decoupled — Postgres owns writes, DuckDB owns analytical reads. If the analytics pipeline fails, the app keeps working; users just see slightly stale numbers."
