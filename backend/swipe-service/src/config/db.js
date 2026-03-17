// =============================================================================
// src/config/db.js — swipe-service
// PostgreSQL pool for swipe_db (host port 5434)
// =============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.POSTGRES_SWIPE_HOST || 'postgres-swipe',
  port:     parseInt(process.env.POSTGRES_SWIPE_PORT || '5432'),
  database: process.env.POSTGRES_SWIPE_DB   || 'swipe_db',
  user:     process.env.POSTGRES_SWIPE_USER,
  password: process.env.POSTGRES_SWIPE_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('[DB] Connected to swipe_db pool'));
pool.on('error',   (err) => console.error('[DB] Pool error:', err.message));

const query = (text, params) => pool.query(text, params);
const testConnection = async () => {
  await pool.query('SELECT 1');
  console.log('[DB] Successfully connected to swipe_db');
};

module.exports = { query, testConnection, pool };
