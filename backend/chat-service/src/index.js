// =============================================================================
// src/index.js — chat-service
//
// STARTUP SEQUENCE:
//   1. connectMongo()    — connect to MongoDB
//   2. startConsumer()   — subscribe to match.created (build valid rooms cache)
//   3. HTTP server       — start Express
//   4. Socket.IO         — attach to the same HTTP server (port sharing)
//
// WHY SOCKET.IO ON THE SAME PORT AS HTTP:
//   Socket.IO performs an HTTP upgrade handshake. The client first makes an
//   HTTP request, then upgrades to WebSocket. By attaching Socket.IO to the
//   same http.Server instance, both HTTP and WebSocket traffic share port 3005.
//   This means the API Gateway only needs to proxy one port per service.
// =============================================================================

require('dotenv').config();

const http    = require('http');
const { Server } = require('socket.io');

const { app, corsOptions } = require('./app');
const { connectMongo, disconnectMongo } = require('./config/db');
const { connectProducer, disconnectProducer, startConsumer, disconnectConsumer } = require('./config/kafka');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 3005;

const start = async () => {
  try {
    // 1. MongoDB
    await connectMongo();

    // 2. Kafka producer (emits message.sent) + consumer (match.created cache)
    await connectProducer();
    await startConsumer();

    // 3. Create HTTP server from Express app
    const httpServer = http.createServer(app);

    // 4. Attach Socket.IO to the HTTP server
    //    CORS is configured separately for Socket.IO — it manages its own headers
    //    during the WebSocket upgrade handshake.
    const io = new Server(httpServer, {
      cors: corsOptions,
      // transports: ['websocket'] would disable long-polling fallback.
      // Keep both for compatibility with environments that block WebSockets.
    });

    // Register all socket event handlers
    initSocket(io);

    // 5. Start listening — HTTP and WebSocket on the same port
    httpServer.listen(PORT, () => {
      console.log(`[HTTP + WebSocket] Chat Service running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`[Shutdown] ${signal} received`);
      await disconnectConsumer();
      await disconnectProducer();
      await disconnectMongo();
      httpServer.close(() => {
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
