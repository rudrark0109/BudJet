WITH source AS (
    SELECT * FROM {{ source('bronze', 'raw_budgets') }}
),

cleaned AS (
    SELECT
        id::INTEGER                             AS budget_id,
        user_id::VARCHAR                        AS user_id,
        category_id::INTEGER                    AS category_id,
        amount::DECIMAL(12, 2)                  AS budget_amount,
        -- Postgres stores month as 'YYYY-MM'; convert to first day for date arithmetic
        (month::VARCHAR || '-01')::DATE         AS budget_month,
        month::VARCHAR                          AS month_key,
        created_at::TIMESTAMP                   AS created_at,
        _extracted_at::TIMESTAMP                AS extracted_at
    FROM source
    WHERE amount IS NOT NULL
      AND amount::DECIMAL > 0
      AND user_id IS NOT NULL
      AND category_id IS NOT NULL
)

SELECT * FROM cleaned
