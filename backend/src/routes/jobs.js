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

router.get('/:userId', requireParamUidMatch('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `
      SELECT id, name, hourly_rate, is_active, created_at
      FROM jobs
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireBodyUidMatch('user_id'), async (req, res) => {
  try {
    const { user_id, name, hourly_rate } = req.body;

    if (!name || hourly_rate === undefined || hourly_rate === null) {
      return res.status(400).json({ error: 'name and hourly_rate are required' });
    }

    const parsedRate = Number(hourly_rate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      return res.status(400).json({ error: 'hourly_rate must be a non-negative number' });
    }

    const result = await pool.query(
      `
      INSERT INTO jobs (user_id, name, hourly_rate)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [user_id, name.trim(), parsedRate]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:jobId', requireBodyUidMatch('user_id'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { user_id, name, hourly_rate, is_active } = req.body;

    const existing = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [jobId, user_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const current = existing.rows[0];
    const nextName = typeof name === 'string' && name.trim() ? name.trim() : current.name;
    const nextRate =
      hourly_rate === undefined || hourly_rate === null ? current.hourly_rate : Number(hourly_rate);

    if (!Number.isFinite(Number(nextRate)) || Number(nextRate) < 0) {
      return res.status(400).json({ error: 'hourly_rate must be a non-negative number' });
    }

    const nextActive = typeof is_active === 'boolean' ? is_active : current.is_active;

    const result = await pool.query(
      `
      UPDATE jobs
      SET name = $1, hourly_rate = $2, is_active = $3
      WHERE id = $4 AND user_id = $5
      RETURNING *
      `,
      [nextName, Number(nextRate), nextActive, jobId, user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
