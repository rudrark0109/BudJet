import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import budgetRoutes from './routes/budgets.js';
import jobRoutes from './routes/jobs.js';
import shiftRoutes from './routes/shifts.js';
import { initializeFirebaseAdmin, verifyFirebaseToken } from './middleware/firebaseAuth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

try {
  initializeFirebaseAdmin();
  console.log('Firebase Admin initialized');
} catch (err) {
  console.error('Firebase Admin initialization failed:', err.message);
}

// Database pool
const useSSL = (process.env.PG_SSL || '').toLowerCase() === 'true';
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  family: 4,
});

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', verifyFirebaseToken, transactionRoutes);
app.use('/api/categories', verifyFirebaseToken, categoryRoutes);
app.use('/api/budgets', verifyFirebaseToken, budgetRoutes);
app.use('/api/jobs', verifyFirebaseToken, jobRoutes);
app.use('/api/shifts', verifyFirebaseToken, shiftRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test DB connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'connected', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`BudJet backend running on http://localhost:${port}`);
});
