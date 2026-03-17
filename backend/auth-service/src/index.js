// =============================================================================
// src/index.js
// Service: auth-service
//
// PURPOSE:
//   The entry point for the Auth Service.
//   Responsible for:
//     1. Loading environment variables from .env
//     2. Connecting to PostgreSQL (auth_db)
//     3. Running the DB init SQL (creates tables if they don't exist)
//     4. Connecting the Kafka producer
//     5. Starting the Express HTTP server
//     6. Registering graceful shutdown handlers
//
// WHY STARTUP ORDER MATTERS:
//   We connect to dependencies BEFORE starting the server.
//   If the server starts accepting requests before the DB is ready,
//   the first requests will fail with connection errors.
//   Startup order: env → DB → Kafka → server.listen()
//
// GRACEFUL SHUTDOWN:
//   When Docker Compose stops a container (SIGTERM), we:
//     1. Stop accepting new requests (server.close)
//     2. Disconnect the Kafka producer (flush in-flight messages)
//     3. Close the DB pool (let pending queries finish)
//     4. Exit cleanly
//   Without this, the container is force-killed after a timeout,
//   potentially losing in-flight Kafka messages.
// =============================================================================

// Load .env file into process.env FIRST — before any other imports
// that might read environment variables at module load time.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const app = require('./app');
const { testConnection, pool } = require('./config/db');
const { connectProducer, disconnectProducer } = require('./config/kafka');
const { redis } = require('./config/redis');
const { query } = require('./config/db');

const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// ---------------------------------------------------------------------------
// initDatabase()
//
// Reads and executes the SQL schema file (src/db/init.sql).
// Creates tables and indexes if they don't already exist.
// Safe to run on every startup — all statements use IF NOT EXISTS.
// ---------------------------------------------------------------------------
const initDatabase = async () => {
  // Build the absolute path to init.sql
  const sqlFilePath = path.join(__dirname, 'db', 'init.sql');

  // Read the SQL file from disk
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  // Execute the entire SQL file as a single statement block
  await query(sql);

  console.log('[DB] Database schema initialized (tables and indexes ready)');
};

// ---------------------------------------------------------------------------
// start()
//
// Main startup function. Runs all setup steps in order, then starts
// the HTTP server. Any failure aborts startup.
// ---------------------------------------------------------------------------
const start = async () => {
  try {
    console.log('[Startup] Auth Service starting...');

    // Step 1: Test DB connection
    await testConnection();

    // Step 2: Create tables if they don't exist
    await initDatabase();

    // Step 3: Connect Kafka producer
    // KafkaJS will retry automatically if Kafka isn't ready yet
    await connectProducer();

    // Step 4: Start the HTTP server
    // server.listen() returns a server instance used for graceful shutdown
    const server = app.listen(PORT, () => {
      console.log(`[Server] Auth Service running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('[Server] Ready to handle requests');
    });

    // -------------------------------------------------------------------------
    // GRACEFUL SHUTDOWN
    //
    // Docker sends SIGTERM when `docker-compose down` or `docker-compose stop`
    // is called. We catch it here to shut down cleanly.
    //
    // SIGINT is sent by Ctrl+C in the terminal.
    //
    // Without these handlers, the process exits immediately (SIGKILL after timeout),
    // potentially losing in-flight messages or leaving DB connections open.
    // -------------------------------------------------------------------------
    const shutdown = async (signal) => {
      console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);

      // 1. Stop accepting new HTTP requests
      // Existing in-flight requests are allowed to complete.
      server.close(async () => {
        console.log('[Shutdown] HTTP server closed (no new requests accepted)');

        try {
          // 2. Disconnect Kafka producer (flushes pending messages)
          await disconnectProducer();
          console.log('[Shutdown] Kafka producer disconnected');

          // 3. Close PostgreSQL pool (waits for active queries to finish)
          await pool.end();
          console.log('[Shutdown] PostgreSQL pool closed');

          // 4. Close Redis connection
          await redis.quit();
          console.log('[Shutdown] Redis connection closed');

          console.log('[Shutdown] Graceful shutdown complete. Bye!');
          process.exit(0); // Clean exit
        } catch (err) {
          console.error('[Shutdown] Error during shutdown:', err.message);
          process.exit(1); // Force exit if cleanup fails
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop / k8s scale down
    process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C

  } catch (err) {
    // If startup fails (DB unreachable, Kafka down, etc.), log the error and exit.
    // Docker Compose will restart the container according to its restart policy.
    console.error('[Startup] Fatal error during startup:', err.message);
    process.exit(1);
  }
};

// Run the startup function
start();
