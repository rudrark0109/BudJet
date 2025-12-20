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

// GET /api/transactions/:userId - Get all transactions for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const query = `
      SELECT 
        t.id, 
        t.amount, 
        t.description, 
        t.type, 
        t.transaction_date,
        t.created_at,
        c.name as category_name,
        c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions - Create a new transaction
router.post('/', async (req, res) => {
  try {
    const { user_id, category_id, amount, description, type, transaction_date } = req.body;

    if (!user_id || !amount || !type) {
      return res.status(400).json({ error: 'user_id, amount, and type are required' });
    }

    const query = `
      INSERT INTO transactions (user_id, category_id, amount, description, type, transaction_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      category_id || null,
      amount,
      description || null,
      type,
      transaction_date || new Date().toISOString().split('T')[0]
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/summary/:userId - Get financial summary
router.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get current month income and expenses
    const summaryQuery = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
      FROM transactions
      WHERE user_id = $1 
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
    
    const summaryResult = await pool.query(summaryQuery, [userId]);
    
    // Get spending by category
    const categoryQuery = `
      SELECT 
        c.name as category,
        c.color,
        SUM(t.amount) as amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 
        AND t.type = 'expense'
        AND EXTRACT(MONTH FROM t.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM t.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY c.id, c.name, c.color
      ORDER BY amount DESC
    `;
    
    const categoryResult = await pool.query(categoryQuery, [userId]);
    
    // Get monthly trend (last 6 months)
    const trendQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE user_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `;
    
    const trendResult = await pool.query(trendQuery, [userId]);
    
    res.json({
      summary: summaryResult.rows[0],
      categoryBreakdown: categoryResult.rows,
      monthlyTrend: trendResult.rows
    });
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
