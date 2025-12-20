import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Database pool (reuse connection config)
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: (process.env.PG_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  family: 4,
});

// POST /api/auth/register - Register or update user after Firebase auth
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { uid, email, displayName } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: 'uid and email are required' });
    }

    await client.query('BEGIN');

    // Upsert user: insert if not exists, update if exists
    const userQuery = `
      INSERT INTO users (uid, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (uid) 
      DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING *;
    `;

    const userResult = await client.query(userQuery, [uid, email, displayName || null]);
    const user = userResult.rows[0];

    // Check if user is new (created_at is very recent, within last 5 seconds)
    const isNewUser = new Date() - new Date(user.created_at) < 5000;

    if (isNewUser) {
      // Create default categories for new user
      const defaultCategories = [
        // Expense categories
        { name: 'Food', type: 'expense', color: '#E8684A' },
        { name: 'Transport', type: 'expense', color: '#5B8FF9' },
        { name: 'Shopping', type: 'expense', color: '#6DC8EC' },
        { name: 'Bills', type: 'expense', color: '#9270CA' },
        { name: 'Entertainment', type: 'expense', color: '#FFD666' },
        { name: 'Healthcare', type: 'expense', color: '#FF85C0' },
        { name: 'Education', type: 'expense', color: '#95DE64' },
        // Income categories
        { name: 'Salary', type: 'income', color: '#52C41A' },
        { name: 'Freelance', type: 'income', color: '#13C2C2' },
        { name: 'Investment', type: 'income', color: '#2F54EB' },
        { name: 'Gift', type: 'income', color: '#FA8C16' }
      ];

      const categoryQuery = `
        INSERT INTO categories (user_id, name, type, color)
        VALUES ($1, $2, $3, $4)
      `;

      for (const cat of defaultCategories) {
        await client.query(categoryQuery, [uid, cat.name, cat.type, cat.color]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'User registered successfully', 
      user,
      isNewUser
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/auth/login - Verify user exists after Firebase login
router.post('/login', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    const query = 'SELECT * FROM users WHERE uid = $1';
    const result = await pool.query(query, [uid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    res.json({ 
      message: 'User authenticated', 
      user: result.rows[0] 
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/user/:uid - Get user profile
router.get('/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const query = 'SELECT uid, email, display_name, created_at FROM users WHERE uid = $1';
    const result = await pool.query(query, [uid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
