-- Grain: user × job × month.
-- Summarises hours worked and gross pay per job per calendar month.
SELECT
    user_id,
    job_id,
    job_name,
    hourly_rate,
    DATE_TRUNC('month', shift_date)            AS month,
    EXTRACT('year'  FROM shift_date)::INTEGER  AS year,
    EXTRACT('month' FROM shift_date)::INTEGER  AS month_num,
    COUNT(*)                                   AS shifts_worked,
    ROUND(SUM(hours_worked), 2)                AS total_hours,
    ROUND(SUM(gross_pay), 2)                   AS total_gross_pay,
    ROUND(AVG(hours_worked), 2)                AS avg_shift_hours
FROM {{ ref('int_shifts_with_duration') }}
GROUP BY 1, 2, 3, 4, 5, 6, 7
