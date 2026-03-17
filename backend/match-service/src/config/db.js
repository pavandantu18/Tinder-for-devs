// =============================================================================
// src/config/db.js — match-service
// PostgreSQL pool for match_db (host port 5435)
// =============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.POSTGRES_MATCH_HOST || 'postgres-match',
  port:     parseInt(process.env.POSTGRES_MATCH_PORT || '5432'),
  database: process.env.POSTGRES_MATCH_DB   || 'match_db',
  user:     process.env.POSTGRES_MATCH_USER,
  password: process.env.POSTGRES_MATCH_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('[DB] Connected to match_db pool'));
pool.on('error',   (err) => console.error('[DB] Pool error:', err.message));

const query = (text, params) => pool.query(text, params);
const testConnection = async () => {
  await pool.query('SELECT 1');
  console.log('[DB] Successfully connected to match_db');
};

module.exports = { query, testConnection, pool };
