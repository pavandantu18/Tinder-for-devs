// =============================================================================
// src/config/db.js
// Service: user-service
//
// PURPOSE:
//   PostgreSQL connection pool for user_db.
//   Identical pattern to auth-service/src/config/db.js —
//   each service owns its own pool connected to its own database.
// =============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.POSTGRES_USER_HOST || 'postgres-user',
  port:     parseInt(process.env.POSTGRES_USER_PORT || '5432'),
  database: process.env.POSTGRES_USER_DB   || 'user_db',
  user:     process.env.POSTGRES_USER_USER,
  password: process.env.POSTGRES_USER_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('[DB] New client connected to user_db pool'));
pool.on('error',   (err) => console.error('[DB] Pool error:', err.message));

const query = (text, params) => pool.query(text, params);

const testConnection = async () => {
  await pool.query('SELECT 1');
  console.log('[DB] Successfully connected to user_db');
};

module.exports = { query, testConnection, pool };
