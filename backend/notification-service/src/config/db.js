// =============================================================================
// src/config/db.js — notification-service
// PostgreSQL pool for notification_db (host port 5436)
// =============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.POSTGRES_NOTIFICATION_HOST || 'postgres-notification',
  port:     parseInt(process.env.POSTGRES_NOTIFICATION_PORT || '5432'),
  database: process.env.POSTGRES_NOTIFICATION_DB   || 'notification_db',
  user:     process.env.POSTGRES_NOTIFICATION_USER,
  password: process.env.POSTGRES_NOTIFICATION_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('[DB] Connected to notification_db pool'));
pool.on('error',   (err) => console.error('[DB] Pool error:', err.message));

const query = (text, params) => pool.query(text, params);
const testConnection = async () => {
  await pool.query('SELECT 1');
  console.log('[DB] Successfully connected to notification_db');
};

module.exports = { query, testConnection, pool };
