-- Grain: user × job × month × cycle_number.
-- Splits each month into semi-monthly pay periods matching the ShiftsPage UI:
--   Cycle 1 — days  1-7
--   Cycle 2 — days  8-15
--   Cycle 3 — days 16-end
SELECT
    user_id,
    job_id,
    job_name,
    hourly_rate,
    DATE_TRUNC('month', shift_date)           AS month,
    EXTRACT('year'  FROM shift_date)::INTEGER AS year,
    EXTRACT('month' FROM shift_date)::INTEGER AS month_num,
    CASE
        WHEN EXTRACT('day' FROM shift_date) BETWEEN 1  AND 7  THEN 1
        WHEN EXTRACT('day' FROM shift_date) BETWEEN 8  AND 15 THEN 2
        ELSE 3
    END                                       AS cycle_number,
    CASE
        WHEN EXTRACT('day' FROM shift_date) BETWEEN 1  AND 7  THEN 'Days 1-7'
        WHEN EXTRACT('day' FROM shift_date) BETWEEN 8  AND 15 THEN 'Days 8-15'
        ELSE 'Days 16-end'
    END                                       AS cycle_label,
    COUNT(*)                                  AS shifts_in_cycle,
    ROUND(SUM(hours_worked), 2)               AS hours_in_cycle,
    ROUND(SUM(gross_pay), 2)                  AS estimated_pay
FROM {{ ref('int_shifts_with_duration') }}
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
ORDER BY month, cycle_number
