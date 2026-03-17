// =============================================================================
// src/index.js — swipe-service
//
// STARTUP SEQUENCE:
//   1. testConnection()      — verify PostgreSQL is reachable
//   2. initDatabase()        — run init.sql to create tables + indexes
//   3. connectProducer()     — connect Kafka producer
//   4. startGrpcServer()     — start gRPC server on port 50053
//   5. server.listen(3003)   — start HTTP server
//
// GRACEFUL SHUTDOWN:
//   SIGTERM / SIGINT → disconnect Kafka → close HTTP server → exit
// =============================================================================

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const app  = require('./app');

const { testConnection, query } = require('./config/db');
const { connectProducer, disconnectProducer } = require('./config/kafka');
const { startGrpcServer } = require('./grpc/server');

const PORT = process.env.PORT || 3003;

// ---------------------------------------------------------------------------
// initDatabase
//
// Runs init.sql on startup to create tables and indexes if they don't exist.
// All statements use IF NOT EXISTS / ON CONFLICT, so this is safe to run
// repeatedly without duplicating data or throwing errors.
// ---------------------------------------------------------------------------
const initDatabase = async () => {
  const sqlPath = path.join(__dirname, 'db', 'init.sql');
  const sql     = fs.readFileSync(sqlPath, 'utf8');
  await query(sql);
  console.log('[DB] swipe_db schema initialized');
};

// ---------------------------------------------------------------------------
// start — boot everything in order
// ---------------------------------------------------------------------------
const start = async () => {
  try {
    // 1. Database
    await testConnection();
    await initDatabase();

    // 2. Kafka producer
    await connectProducer();

    // 3. gRPC server (CheckMutualLike + GetSwipedUserIds)
    startGrpcServer();

    // 4. HTTP server
    const server = app.listen(PORT, () => {
      console.log(`[HTTP] Swipe Service running on port ${PORT}`);
    });

    // -----------------------------------------------------------------------
    // Graceful shutdown
    // Docker sends SIGTERM when the container stops.
    // We give in-flight requests a chance to finish before exiting.
    // -----------------------------------------------------------------------
    const shutdown = async (signal) => {
      console.log(`[Shutdown] ${signal} received — shutting down`);
      await disconnectProducer();
      server.close(() => {
        console.log('[Shutdown] HTTP server closed');
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
