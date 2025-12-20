import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';

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

// GET /api/budgets/:userId - Get all budgets for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const query = `
      SELECT 
        b.id,
        b.amount as target,
        b.month,
        c.name as category_name,
        c.color,
        COALESCE(
          (SELECT SUM(t.amount) 
           FROM transactions t 
           WHERE t.category_id = b.category_id 
             AND t.user_id = $1
             AND TO_CHAR(t.created_at, 'YYYY-MM') = b.month
             AND t.type = 'expense'), 
          0
        ) as current
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = $1
      ORDER BY b.month DESC, c.name ASC
    `;
    
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get budgets error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets - Create a new budget
router.post('/', async (req, res) => {
  try {
    const { user_id, category_id, amount, month } = req.body;

    if (!user_id || !category_id || !amount || !month) {
      return res.status(400).json({ error: 'user_id, category_id, amount, and month are required' });
    }

    const query = `
      INSERT INTO budgets (user_id, category_id, amount, month)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, category_id, month) 
      DO UPDATE SET amount = EXCLUDED.amount
      RETURNING *
    `;

    const result = await pool.query(query, [user_id, category_id, amount, month]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create budget error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
