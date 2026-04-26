-- Grain: user × month.
-- Top-line income vs expenses and net cashflow per calendar month.
SELECT
    user_id,
    month,
    year,
    month_num,
    SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
    SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END)
  - SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS net_cashflow,
    COUNT(CASE WHEN transaction_type = 'income'  THEN 1 END)           AS income_count,
    COUNT(CASE WHEN transaction_type = 'expense' THEN 1 END)           AS expense_count,
    COUNT(*)                                                           AS total_transactions
FROM {{ ref('fct_transactions') }}
GROUP BY 1, 2, 3, 4
ORDER BY user_id, month
