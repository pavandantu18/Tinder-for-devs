// =============================================================================
// src/routes/proxy.js
// Service: api-gateway
//
// PURPOSE:
//   Defines a proxy rule for each downstream service.
//   When a request arrives at the gateway, it's forwarded to the correct
//   service based on the URL prefix.
//
// ROUTING TABLE:
//   /api/auth/*          → auth-service:3001
//   /api/users/*         → user-service:3002   (Step 4)
//   /api/swipes/*        → swipe-service:3003  (Step 5)
//   /api/matches/*       → match-service:3004  (Step 6)
//   /api/chat/*          → chat-service:3005   (Step 7)
//   /api/notifications/* → notification-service:3006 (Step 8)
//
// HOW http-proxy-middleware WORKS:
//   createProxyMiddleware({ target }) returns an Express middleware.
//   When a request hits it, the middleware forwards the full request
//   (headers, body, method) to the target URL and streams the response
//   back to the original client.
//
// onProxyReq — fires just before the request is forwarded.
//   We use it to inject the X-Gateway-Request header so downstream
//   services can confirm the request came through the gateway (not directly).
//
// onError — fires if the downstream service is unreachable.
//   Returns a 503 Service Unavailable instead of crashing the gateway.
// =============================================================================

const { createProxyMiddleware } = require('http-proxy-middleware');

// ---------------------------------------------------------------------------
// createServiceProxy(target, serviceName, pathFilter)
//
// Factory function — creates a proxy middleware for a downstream service.
//
// PARAMS:
//   target      (string)         — the downstream service's base URL
//   serviceName (string)         — human-readable name for logging
//   pathFilter  (string | regex) — only proxy requests whose path starts with this
//
// WHY pathFilter INSTEAD OF app.use('/prefix', proxy):
//   When you do app.use('/api/auth', proxy), Express strips '/api/auth' from
//   req.url before the proxy sees it. So POST /api/auth/login becomes
//   POST /login at the proxy, and the downstream service returns 404.
//   Using pathFilter keeps the full path intact — the proxy sees and forwards
//   the complete /api/auth/login path. The downstream service receives exactly
//   what it expects.
// ---------------------------------------------------------------------------
const createServiceProxy = (target, serviceName, pathFilter) =>
  createProxyMiddleware({
    target,
    pathFilter,
      // Only intercept requests whose path matches this prefix.
      // All other requests pass through to the next middleware.

    changeOrigin: true,
      // Rewrites the Host header to match the target.

    on: {
      // -----------------------------------------------------------------------
      // proxyReq — fires right before the request is sent to the downstream service
      //
      // Use this to modify the outgoing request:
      //   - Add the X-Gateway-Request header (proves request came through gateway)
      //   - X-User-Id and X-User-Email are already set by auth middleware
      // -----------------------------------------------------------------------
      proxyReq: (proxyReq, req) => {
        // Mark this request as coming from the gateway.
        // Downstream services can reject requests without this header
        // if they're ever accidentally exposed to the internet.
        proxyReq.setHeader('X-Gateway-Request', 'true');

        // Forward the real client IP to downstream services
        const clientIp =
          req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
        proxyReq.setHeader('X-Forwarded-For', clientIp);
      },

      // -----------------------------------------------------------------------
      // proxyRes — fires when the downstream service responds
      //
      // Used here only for logging. In production you could add response
      // transformation, caching, or metrics collection here.
      // -----------------------------------------------------------------------
      proxyRes: (proxyRes, req) => {
        console.log(
          `[Proxy] ${req.method} ${req.path} → ${serviceName} → ${proxyRes.statusCode}`
        );
      },

      // -----------------------------------------------------------------------
      // error — fires if the downstream service is unreachable (ECONNREFUSED, timeout)
      //
      // Without this handler, the gateway would crash or hang.
      // We return a 503 so the client knows the service is temporarily down.
      // -----------------------------------------------------------------------
      error: (err, req, res) => {
        console.error(`[Proxy] Error routing to ${serviceName}:`, err.message);
        // Check if headers have already been sent (can't send again)
        if (!res.headersSent) {
          res.status(503).json({
            error: `${serviceName} is temporarily unavailable. Please try again shortly.`,
          });
        }
      },
    },
  });

// ---------------------------------------------------------------------------
// SERVICE PROXY INSTANCES
//
// One proxy per downstream service. Each is created once at startup.
// Adding a new service = add one line here + register the route in app.js.
//
// Services not yet built are commented out — uncomment as each step completes.
// ---------------------------------------------------------------------------

// Auth Service — handles /api/auth/* (register, login, logout, Google OAuth)
const authServiceProxy = createServiceProxy(
  process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  'auth-service',
  '/api/auth'   // pathFilter — only intercept /api/auth/* requests
);

// User Service — handles /api/users/* (profile CRUD, discovery)
const userServiceProxy = createServiceProxy(
  process.env.USER_SERVICE_URL || 'http://user-service:3002',
  'user-service',
  '/api/users'
);

// Swipe Service — handles /api/swipes/* (LIKE/PASS actions)
const swipeServiceProxy = createServiceProxy(
  process.env.SWIPE_SERVICE_URL || 'http://swipe-service:3003',
  'swipe-service',
  '/api/swipes'
);

// Match Service — handles /api/matches/*
const matchServiceProxy = createServiceProxy(
  process.env.MATCH_SERVICE_URL || 'http://match-service:3004',
  'match-service',
  '/api/matches'
);

// Chat Service — handles /api/chat/* (REST) and /socket.io/* (WebSocket)
// WebSocket proxy: ws: true enables upgrade proxying for Socket.IO
const chatServiceProxy = createProxyMiddleware({
  target: process.env.CHAT_SERVICE_URL || 'http://chat-service:3005',
  pathFilter: ['/api/chat', '/socket.io'],
  changeOrigin: true,
  ws: true,   // ← enables WebSocket upgrade proxying for Socket.IO
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('X-Gateway-Request', 'true');
    },
    error: (err, req, res) => {
      console.error('[Proxy] Error routing to chat-service:', err.message);
      if (!res.headersSent) {
        res.status(503).json({ error: 'chat-service is temporarily unavailable.' });
      }
    },
  },
});

// Notification Service — handles /api/notifications/*
// Uncomment in Step 8
// const notificationServiceProxy = createServiceProxy(
//   process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006',
//   'notification-service',
//   '/api/notifications'
// );

module.exports = {
  authServiceProxy,
  userServiceProxy,
  swipeServiceProxy,
  matchServiceProxy,
  chatServiceProxy,
  // chatServiceProxy,         // Step 7
  // notificationServiceProxy, // Step 8
};
