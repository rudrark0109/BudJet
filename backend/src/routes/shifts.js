import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { requireBodyUidMatch, requireParamUidMatch } from '../middleware/firebaseAuth.js';

dotenv.config();

const router = express.Router();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: (process.env.PG_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  family: 4,
});

function parseTimeToMinutes(timeValue) {
  if (!timeValue) {
    return null;
  }
  const [h = '0', m = '0'] = String(timeValue).split(':');
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function calculateHours(clockIn, clockOut) {
  const inMinutes = parseTimeToMinutes(clockIn);
  const outMinutes = parseTimeToMinutes(clockOut);

  if (inMinutes === null || outMinutes === null) {
    return 0;
  }

  let diffMinutes = outMinutes - inMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  return Number((diffMinutes / 60).toFixed(2));
}

function toMonthBounds(month) {
  const now = new Date();
  const y = month ? Number(month.split('-')[0]) : now.getFullYear();
  const m = month ? Number(month.split('-')[1]) : now.getMonth() + 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);

  const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const endStr = `${y}-${String(m).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  return { startStr, endStr, year: y, month: m, daysInMonth: end.getDate() };
}

function toDatePart(value) {
  return String(value).split('T')[0];
}

router.get('/:userId', requireParamUidMatch('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;
    const { startStr, endStr } = toMonthBounds(month);

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.user_id,
        s.job_id,
        j.name AS job_name,
        j.hourly_rate,
        s.shift_date,
        s.clock_in,
        s.clock_out,
        s.created_at,
        s.updated_at
      FROM shifts s
      JOIN jobs j ON s.job_id = j.id
      WHERE s.user_id = $1
        AND s.shift_date >= $2
        AND s.shift_date <= $3
      ORDER BY s.shift_date DESC, s.clock_in DESC
      `,
      [userId, startStr, endStr]
    );

    const rows = result.rows.map((row) => {
      const hoursWorked = calculateHours(row.clock_in, row.clock_out);
      const expectedEarnings = Number((hoursWorked * Number(row.hourly_rate || 0)).toFixed(2));
      return {
        ...row,
        hours_worked: hoursWorked,
        expected_earnings: expectedEarnings,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/clock-in', requireBodyUidMatch('user_id'), async (req, res) => {
  try {
    const { user_id, job_id, shift_date, clock_in } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    const jobCheck = await pool.query('SELECT id FROM jobs WHERE id = $1 AND user_id = $2', [job_id, user_id]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const openShift = await pool.query(
      `
      SELECT id FROM shifts
      WHERE user_id = $1 AND job_id = $2 AND clock_out IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user_id, job_id]
    );

    if (openShift.rows.length > 0) {
      return res.status(409).json({ error: 'There is already an active shift for this job' });
    }

    const now = new Date();
    const defaultDate = toDatePart(now.toISOString());
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await pool.query(
      `
      INSERT INTO shifts (user_id, job_id, shift_date, clock_in)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [user_id, job_id, shift_date || defaultDate, clock_in || defaultTime]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Clock in error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:shiftId/clock-out', requireBodyUidMatch('user_id'), async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { user_id, clock_out } = req.body;

    const shift = await pool.query('SELECT * FROM shifts WHERE id = $1 AND user_id = $2', [shiftId, user_id]);
    if (shift.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await pool.query(
      `
      UPDATE shifts
      SET clock_out = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *
      `,
      [clock_out || defaultTime, shiftId, user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Clock out error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:shiftId', requireBodyUidMatch('user_id'), async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { user_id, shift_date, clock_in, clock_out } = req.body;

    const existing = await pool.query('SELECT * FROM shifts WHERE id = $1 AND user_id = $2', [shiftId, user_id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const current = existing.rows[0];
    const nextShiftDate = shift_date || toDatePart(current.shift_date);
    const nextClockIn = clock_in || current.clock_in;
    const nextClockOut = clock_out === undefined ? current.clock_out : clock_out;

    const result = await pool.query(
      `
      UPDATE shifts
      SET shift_date = $1,
          clock_in = $2,
          clock_out = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
      RETURNING *
      `,
      [nextShiftDate, nextClockIn, nextClockOut, shiftId, user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update shift error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/pay-cycle/:userId', requireParamUidMatch('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    const now = new Date();
    const targetYear = year ? Number(year) : now.getFullYear();
    const targetMonth = month ? Number(month) : now.getMonth() + 1;
    const { startStr, endStr, daysInMonth } = toMonthBounds(`${targetYear}-${String(targetMonth).padStart(2, '0')}`);

    const result = await pool.query(
      `
      SELECT s.shift_date, s.clock_in, s.clock_out, j.hourly_rate
      FROM shifts s
      JOIN jobs j ON s.job_id = j.id
      WHERE s.user_id = $1
        AND s.shift_date >= $2
        AND s.shift_date <= $3
      ORDER BY s.shift_date ASC
      `,
      [userId, startStr, endStr]
    );

    let bucketOneToSeven = 0;
    let bucketEightToFifteen = 0;
    let bucketSixteenToEnd = 0;

    for (const row of result.rows) {
      const hours = calculateHours(row.clock_in, row.clock_out);
      const earnings = hours * Number(row.hourly_rate || 0);
      const date = new Date(row.shift_date);
      const day = date.getDate();

      if (day >= 1 && day <= 7) {
        bucketOneToSeven += earnings;
      } else if (day >= 8 && day <= 15) {
        bucketEightToFifteen += earnings;
      } else {
        bucketSixteenToEnd += earnings;
      }
    }

    const expectedOn16th = Number((bucketOneToSeven + bucketEightToFifteen).toFixed(2));
    const expectedOn1stNextMonth = Number(bucketSixteenToEnd.toFixed(2));

    res.json({
      period: {
        year: targetYear,
        month: targetMonth,
        days_in_month: daysInMonth,
      },
      weekly_buckets: {
        days_1_to_7: Number(bucketOneToSeven.toFixed(2)),
        days_8_to_15: Number(bucketEightToFifteen.toFixed(2)),
        days_16_to_end: Number(bucketSixteenToEnd.toFixed(2)),
      },
      expected_payouts: {
        payout_on_16th: expectedOn16th,
        payout_on_1st_next_month: expectedOn1stNextMonth,
      },
    });
  } catch (err) {
    console.error('Pay cycle estimate error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:shiftId', requireBodyUidMatch('user_id'), async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { user_id } = req.body;

    const existing = await pool.query('SELECT id FROM shifts WHERE id = $1 AND user_id = $2', [shiftId, user_id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    await pool.query('DELETE FROM shifts WHERE id = $1 AND user_id = $2', [shiftId, user_id]);
    res.status(204).end();
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
