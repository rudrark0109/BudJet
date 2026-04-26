-- One row per category per user. Used as a lookup by all transaction-based marts.
SELECT
    category_id,
    user_id,
    category_name,
    category_type,
    color,
    created_at
FROM {{ ref('stg_categories') }}
