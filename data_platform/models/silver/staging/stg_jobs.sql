WITH source AS (
    SELECT * FROM {{ source('bronze', 'raw_jobs') }}
),

cleaned AS (
    SELECT
        id::INTEGER                  AS job_id,
        user_id::VARCHAR             AS user_id,
        TRIM(name)                   AS job_name,
        hourly_rate::DECIMAL(10, 2)  AS hourly_rate,
        is_active::BOOLEAN           AS is_active,
        created_at::TIMESTAMP        AS created_at,
        _extracted_at::TIMESTAMP     AS extracted_at
    FROM source
    WHERE user_id IS NOT NULL
      AND hourly_rate IS NOT NULL
      AND hourly_rate::DECIMAL >= 0
)

SELECT * FROM cleaned
