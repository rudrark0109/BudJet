-- Joins completed shifts with their job to compute hours_worked and gross_pay.
-- Uses explicit EXTRACT arithmetic because DuckDB TIME subtraction is interval-typed.
WITH shifts AS (
    SELECT * FROM {{ ref('stg_shifts') }}
),

jobs AS (
    SELECT * FROM {{ ref('stg_jobs') }}
),

with_duration AS (
    SELECT
        s.shift_id,
        s.user_id,
        s.job_id,
        j.job_name,
        j.hourly_rate,
        j.is_active       AS job_is_active,
        s.shift_date,
        s.clock_in,
        s.clock_out,

        -- Decimal hours: (clock_out seconds since midnight) - (clock_in seconds since midnight)
        ROUND(
            (
                  EXTRACT(HOUR   FROM s.clock_out) * 3600
                + EXTRACT(MINUTE FROM s.clock_out) * 60
                + EXTRACT(SECOND FROM s.clock_out)
                - EXTRACT(HOUR   FROM s.clock_in) * 3600
                - EXTRACT(MINUTE FROM s.clock_in) * 60
                - EXTRACT(SECOND FROM s.clock_in)
            ) / 3600.0,
            4
        ) AS hours_worked,

        -- Gross pay = hours * hourly_rate
        ROUND(
            (
                (
                      EXTRACT(HOUR   FROM s.clock_out) * 3600
                    + EXTRACT(MINUTE FROM s.clock_out) * 60
                    + EXTRACT(SECOND FROM s.clock_out)
                    - EXTRACT(HOUR   FROM s.clock_in) * 3600
                    - EXTRACT(MINUTE FROM s.clock_in) * 60
                    - EXTRACT(SECOND FROM s.clock_in)
                ) / 3600.0
            ) * j.hourly_rate,
            2
        ) AS gross_pay,

        s.created_at,
        s.updated_at
    FROM shifts s
    INNER JOIN jobs j ON s.job_id = j.job_id
)

SELECT * FROM with_duration
WHERE hours_worked > 0
