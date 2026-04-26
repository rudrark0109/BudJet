-- Base fact table: one row per transaction, category attributes denormalized in.
-- All other transaction-based marts derive from this model.
WITH transactions AS (
    SELECT * FROM {{ ref('stg_transactions') }}
),

categories AS (
    SELECT * FROM {{ ref('dim_categories') }}
)

SELECT
    t.transaction_id,
    t.user_id,
    t.amount,
    t.transaction_type,
    t.category_id,
    c.category_name,
    c.category_type,
    c.color                                           AS category_color,
    t.description,
    t.transaction_date,
    DATE_TRUNC('month', t.transaction_date)           AS month,
    EXTRACT('year'  FROM t.transaction_date)::INTEGER AS year,
    EXTRACT('month' FROM t.transaction_date)::INTEGER AS month_num,
    t.created_at
FROM transactions t
LEFT JOIN categories c
    ON  t.category_id = c.category_id
    AND t.user_id     = c.user_id
