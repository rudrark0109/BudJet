WITH source AS (
    SELECT * FROM {{ source('bronze', 'raw_categories') }}
),

cleaned AS (
    SELECT
        id::INTEGER               AS category_id,
        user_id::VARCHAR          AS user_id,
        TRIM(name)                AS category_name,
        type::VARCHAR             AS category_type,
        COALESCE(color, '#6B7280') AS color,
        created_at::TIMESTAMP     AS created_at,
        _extracted_at::TIMESTAMP  AS extracted_at
    FROM source
    WHERE name IS NOT NULL
      AND type IN ('income', 'expense')
      AND user_id IS NOT NULL
)

SELECT * FROM cleaned
