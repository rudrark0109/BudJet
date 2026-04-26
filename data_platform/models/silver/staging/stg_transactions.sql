WITH source AS (
    SELECT * FROM {{ source('bronze', 'raw_transactions') }}
),

cleaned AS (
    SELECT
        id::INTEGER                    AS transaction_id,
        user_id::VARCHAR               AS user_id,
        category_id::INTEGER           AS category_id,
        amount::DECIMAL(12, 2)         AS amount,
        TRIM(COALESCE(description, '')) AS description,
        type::VARCHAR                  AS transaction_type,
        transaction_date::DATE         AS transaction_date,
        created_at::TIMESTAMP          AS created_at,
        _extracted_at::TIMESTAMP       AS extracted_at
    FROM source
    WHERE amount IS NOT NULL
      AND amount::DECIMAL > 0
      AND type IN ('income', 'expense')
      AND transaction_date IS NOT NULL
      AND user_id IS NOT NULL
)

SELECT * FROM cleaned
