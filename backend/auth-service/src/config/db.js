// =============================================================================
// src/config/db.js
// Service: auth-service
//
// PURPOSE:
//   Creates and exports a PostgreSQL connection pool.
//   A "pool" maintains multiple open database connections and hands them out
//   to queries as needed, then returns them to the pool when done.
//
// WHY A POOL INSTEAD OF A SINGLE CONNECTION:
//   A single connection handles one query at a time. If two requests arrive
//   simultaneously, the second waits. A pool (e.g., 10 connections) lets
//   10 queries run in parallel. Under load, this makes a huge difference.
//
// HOW IT WORKS:
//   - On startup, the pool creates a minimum number of connections
//   - When a query runs: pool.query(sql, params)
//     1. Pool grabs a free connection (or waits if all are busy)
//     2. Runs the query
//     3. Returns the connection to the pool
//   - You never manage individual connections manually
//
// USAGE IN OTHER FILES:
//   const { query } = require('./config/db');
//   const result = await query('SELECT * FROM credentials WHERE email = $1', [email]);
//   result.rows → array of matching rows
// =============================================================================

const { Pool } = require('pg');

// pg.Pool reads these exact environment variable names automatically,
// but we set them explicitly here for clarity and documentation.
const pool = new Pool({
  host: process.env.POSTGRES_AUTH_HOST || 'postgres-auth',
    // 'postgres-auth' is the Docker container name — Docker DNS resolves it
    // to the container's IP. Outside Docker, use 'localhost'.

  port: parseInt(process.env.POSTGRES_AUTH_PORT || '5432'),
    // Port the PostgreSQL process listens on inside the container.

  database: process.env.POSTGRES_AUTH_DB || 'auth_db',
    // The database name, created by Docker Compose on first run.

  user: process.env.POSTGRES_AUTH_USER,
    // Loaded from .env via Docker Compose environment injection.

  password: process.env.POSTGRES_AUTH_PASSWORD,
    // Loaded from .env — never hardcode passwords.

  max: 10,
    // Maximum number of connections in the pool.
    // If all 10 are busy and a new query arrives, it queues until one frees up.

  idleTimeoutMillis: 30000,
    // A connection idle for 30 seconds is closed and removed from the pool.
    // Prevents keeping stale connections open unnecessarily.

  connectionTimeoutMillis: 2000,
    // If a connection can't be established in 2 seconds, throw an error.
    // Prevents queries from hanging indefinitely if the DB is unreachable.
});

// Log when the pool successfully acquires a connection (helpful during startup debugging)
pool.on('connect', () => {
  console.log('[DB] New client connected to auth_db pool');
});

// Log pool errors — these are background errors not tied to a specific query
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
  // Don't crash the process — the pool will try to reconnect automatically
});

// ---------------------------------------------------------------------------
// query(text, params)
//
// A thin wrapper around pool.query() that adds logging.
// Using a wrapper means we can add metrics, logging, or tracing here
// later without touching every file that runs queries.
//
// PARAMS:
//   text   (string)  — SQL query with $1, $2 placeholders (parameterized)
//   params (array)   — Values to substitute for the placeholders
//
// RETURNS:
//   Promise<QueryResult> — { rows: [...], rowCount: N, ... }
//
// WHY PARAMETERIZED QUERIES ($1, $2):
//   Never interpolate values directly into SQL strings:
//     BAD:  `SELECT * FROM users WHERE email = '${email}'`  ← SQL injection risk
//     GOOD: query('SELECT * FROM users WHERE email = $1', [email])
//   With parameterized queries, pg sends the SQL and values separately.
//   The database treats values as data, never as SQL code.
// ---------------------------------------------------------------------------
const query = (text, params) => {
  return pool.query(text, params);
};

// ---------------------------------------------------------------------------
// testConnection()
//
// Runs a trivial query to verify the pool can reach the database.
// Called once on startup to fail fast if DB is unreachable.
// ---------------------------------------------------------------------------
const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] Successfully connected to auth_db');
  } catch (err) {
    console.error('[DB] Failed to connect to auth_db:', err.message);
    throw err; // Re-throw so startup fails loudly if DB is down
  }
};

module.exports = { query, testConnection, pool };
