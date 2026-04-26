-- Grain: user × category × month.
-- Compares actual spend against the user's set budget for that category and month.
WITH actual AS (
    SELECT * FROM {{ ref('mart_monthly_spend') }}
),

budgets AS (
    SELECT
        b.user_id,
        b.category_id,
        b.budget_amount,
        b.budget_month
    FROM {{ ref('stg_budgets') }} b
),

joined AS (
    SELECT
        a.user_id,
        a.category_id,
        a.category_name,
        a.category_color,
        a.month,
        a.year,
        a.month_num,
        a.total_amount                                      AS actual_spend,
        a.transaction_count,
        b.budget_amount,
        COALESCE(b.budget_amount, 0) - a.total_amount       AS remaining,
        ROUND(
            CASE
                WHEN b.budget_amount IS NULL OR b.budget_amount = 0 THEN NULL
                ELSE (a.total_amount / b.budget_amount) * 100
            END,
            1
        )                                                   AS pct_used,
        CASE
            WHEN b.budget_amount IS NULL             THEN 'no_budget'
            WHEN a.total_amount > b.budget_amount    THEN 'over'
            WHEN a.total_amount > b.budget_amount * 0.8 THEN 'warning'
            ELSE 'ok'
        END                                                 AS budget_status
    FROM actual a
    LEFT JOIN budgets b
        ON  a.user_id     = b.user_id
        AND a.category_id = b.category_id
        AND a.month       = b.budget_month
)

SELECT * FROM joined
