WITH source AS (
    SELECT * FROM {{ source('bronze', 'raw_shifts') }}
),

cleaned AS (
    SELECT
        id::INTEGER               AS shift_id,
        user_id::VARCHAR          AS user_id,
        job_id::INTEGER           AS job_id,
        shift_date::DATE          AS shift_date,
        clock_in::TIME            AS clock_in,
        clock_out::TIME           AS clock_out,
        created_at::TIMESTAMP     AS created_at,
        updated_at::TIMESTAMP     AS updated_at,
        _extracted_at::TIMESTAMP  AS extracted_at
    FROM source
    -- Only include completed shifts (clock_out recorded)
    WHERE clock_out IS NOT NULL
      AND user_id IS NOT NULL
      AND job_id IS NOT NULL
)

SELECT * FROM cleaned
