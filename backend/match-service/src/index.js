// =============================================================================
// src/index.js — match-service
//
// STARTUP SEQUENCE:
//   1. testConnection()      — verify PostgreSQL (match_db)
//   2. initDatabase()        — create matches table
//   3. connectProducer()     — connect Kafka producer (emits match.created)
//   4. startConsumer()       — subscribe to swipe.created, process mutual likes
//   5. startGrpcServer()     — gRPC server on port 50054 (CheckMatchExists)
//   6. server.listen(3004)   — HTTP server
// =============================================================================

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const app  = require('./app');

const { testConnection, query } = require('./config/db');
const {
  connectProducer,
  disconnectProducer,
  startConsumer,
  disconnectConsumer,
} = require('./config/kafka');
const { startGrpcServer } = require('./grpc/server');
const { processSwipe }    = require('./services/match.service');

const PORT = process.env.PORT || 3004;

const initDatabase = async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
  await query(sql);
  console.log('[DB] match_db schema initialized');
};

const start = async () => {
  try {
    await testConnection();
    await initDatabase();
    await connectProducer();

    // Subscribe to swipe.created — processSwipe handles mutual like detection
    await startConsumer(processSwipe);

    // gRPC server — Chat Service calls CheckMatchExists
    startGrpcServer();

    const server = app.listen(PORT, () => {
      console.log(`[HTTP] Match Service running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`[Shutdown] ${signal} received`);
      await disconnectConsumer();
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
