-- Grain: user × category × month.
-- Powers the category donut chart and monthly trend bar chart.
SELECT
    user_id,
    category_id,
    category_name,
    category_type,
    category_color,
    month,
    year,
    month_num,
    SUM(amount)    AS total_amount,
    COUNT(*)       AS transaction_count,
    AVG(amount)    AS avg_transaction_amount,
    MIN(amount)    AS min_transaction_amount,
    MAX(amount)    AS max_transaction_amount
FROM {{ ref('fct_transactions') }}
WHERE transaction_type = 'expense'
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
