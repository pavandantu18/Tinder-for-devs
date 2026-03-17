// =============================================================================
// src/index.js
// Service: user-service
//
// PURPOSE:
//   Entry point. Connects to DB, starts Kafka consumer, starts gRPC server,
//   then starts the Express HTTP server.
//
// STARTUP ORDER:
//   1. Connect to PostgreSQL (user_db)
//   2. Run DB init SQL (create tables if not exist)
//   3. Start Kafka consumer → subscribe to user.created
//   4. Start gRPC server (port 50052)
//   5. Start Express HTTP server (port 3002)
// =============================================================================

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const app  = require('./app');
const { testConnection, pool, query } = require('./config/db');
const { startConsumer, disconnectConsumer } = require('./config/kafka');
const { createBlankProfile } = require('./services/user.service');
const { startGrpcServer } = require('./grpc/server');

const PORT = process.env.USER_SERVICE_PORT || 3002;

const initDatabase = async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
  await query(sql);
  console.log('[DB] user_db schema initialized');
};

const start = async () => {
  try {
    console.log('[Startup] User Service starting...');

    // 1. Database
    await testConnection();
    await initDatabase();

    // 2. Kafka consumer — listen for new user registrations
    await startConsumer(async ({ userId, email }) => {
      // This function is called every time a user.created event arrives.
      // We create a blank profile row so the user can fill it in later.
      await createBlankProfile(userId, email);
    });

    // 3. gRPC server — used by Match Service in Step 6
    startGrpcServer();

    // 4. HTTP server
    const server = app.listen(PORT, () => {
      console.log(`[Server] User Service running on port ${PORT}`);
      console.log('[Server] Ready to handle requests');
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Shutdown] ${signal} — shutting down User Service...`);
      server.close(async () => {
        await disconnectConsumer();
        await pool.end();
        console.log('[Shutdown] Clean shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Startup] Fatal error:', err.message);
    process.exit(1);
  }
};

start();
