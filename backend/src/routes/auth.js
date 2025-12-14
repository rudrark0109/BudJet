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
  try {
    const { uid, email, displayName } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: 'uid and email are required' });
    }

    // Upsert user: insert if not exists, update if exists
    const query = `
      INSERT INTO users (uid, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (uid) 
      DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING *;
    `;

    const result = await pool.query(query, [uid, email, displayName || null]);
    res.status(201).json({ 
      message: 'User registered successfully', 
      user: result.rows[0] 
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
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
