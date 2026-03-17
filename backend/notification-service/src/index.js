// =============================================================================
// src/index.js — notification-service
//
// STARTUP SEQUENCE:
//   1. testConnection()  — verify PostgreSQL
//   2. initDatabase()    — create notifications table
//   3. startConsumer()   — subscribe to match.created + message.sent
//   4. server.listen()   — HTTP server with SSE endpoint
// =============================================================================

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const app  = require('./app');

const { testConnection, query } = require('./config/db');
const { startConsumer, disconnectConsumer } = require('./config/kafka');
const { handleMatchCreated, handleMessageSent } = require('./services/notification.service');

const PORT = process.env.PORT || 3006;

const initDatabase = async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
  await query(sql);
  console.log('[DB] notification_db schema initialized');
};

const start = async () => {
  try {
    await testConnection();
    await initDatabase();

    await startConsumer({
      onMatchCreated:  handleMatchCreated,
      onMessageSent:   handleMessageSent,
    });

    const server = app.listen(PORT, () => {
      console.log(`[HTTP] Notification Service running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`[Shutdown] ${signal} received`);
      await disconnectConsumer();
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
