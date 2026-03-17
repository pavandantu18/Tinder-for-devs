// =============================================================================
// src/index.js
// Service: api-gateway
//
// PURPOSE:
//   Entry point for the API Gateway.
//   Connects to Redis, starts the HTTP server, registers graceful shutdown.
//
// The gateway has no database — it only needs Redis (for rate limiting
// and JWT blacklist checks). Startup is therefore simpler than other services.
// =============================================================================

require('dotenv').config();

const app = require('./app');
const { redis } = require('./config/redis');

const PORT = process.env.API_GATEWAY_PORT || 3000;

const start = async () => {
  try {
    console.log('[Startup] API Gateway starting...');

    // Verify Redis is reachable before accepting traffic.
    // Without Redis, rate limiting and blacklist checks won't work.
    await redis.ping();
    console.log('[Startup] Redis connection verified');

    const server = app.listen(PORT, () => {
      console.log(`[Server] API Gateway running on port ${PORT}`);
      console.log('[Server] Routing table:');
      console.log('  /api/auth/*   → auth-service:3001');
      console.log('  (more routes added in Steps 4-8)');
    });

    // Graceful shutdown — flush Redis connection before exiting
    const shutdown = async (signal) => {
      console.log(`\n[Shutdown] ${signal} received. Shutting down...`);
      server.close(async () => {
        await redis.quit();
        console.log('[Shutdown] Redis disconnected. Bye!');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Startup] Fatal error:', err.message);
    process.exit(1);
  }
};

start();
