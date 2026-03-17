// =============================================================================
// src/app.js
// Service: api-gateway
//
// PURPOSE:
//   Assembles the Express app — wires middleware and proxy routes together.
//
// REQUEST LIFECYCLE (what happens to every request):
//   1. CORS check          — is this origin allowed?
//   2. Request logging     — log method + path for debugging
//   3. Rate limit check    — has this IP exceeded the limit?
//   4. JWT authentication  — is the token valid? (skipped for public routes)
//   5. Proxy               — forward to the matching downstream service
//
// Each step can short-circuit the chain by calling res.json() instead of next().
// If all steps pass, the request reaches the proxy and is forwarded.
// =============================================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimitMiddleware = require('./middleware/rateLimit');
const authenticate = require('./middleware/auth');
const { authServiceProxy } = require('./routes/proxy');

const app = express();

// =============================================================================
// STEP 1 — CORS
// Allow the React frontend (port 5173) to make requests to this gateway.
// =============================================================================
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// =============================================================================
// STEP 2 — LOGGING
// Log every incoming request: "POST /api/auth/login 200 12ms"
// =============================================================================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// =============================================================================
// STEP 3 — RATE LIMITING
// Applied to every request before any auth or proxying.
// Rejects with 429 if the IP has exceeded 100 requests/minute.
// =============================================================================
app.use(rateLimitMiddleware);

// =============================================================================
// STEP 4 — JWT AUTHENTICATION
// Verifies the token for protected routes.
// Public routes (login, register, Google OAuth) are skipped automatically.
// Injects X-User-Id and X-User-Email headers for downstream services.
// =============================================================================
app.use(authenticate);

// =============================================================================
// STEP 5 — PROXY ROUTES
// After passing rate limiting and auth, forward to the right service.
//
// ORDER MATTERS: more specific paths must come before less specific ones.
// e.g., /api/auth/google/callback before /api/auth
//
// As new services are built (Steps 4-8), new app.use() lines are added here.
// =============================================================================

// Each proxy uses pathFilter internally (defined in proxy.js) to match
// only its own routes. We mount all proxies at root so Express does NOT
// strip any prefix from req.url — the downstream service receives the
// full original path (e.g., /api/auth/login, not just /login).
app.use(authServiceProxy);           // Intercepts /api/auth/*

// Uncomment as each service is built:
// app.use(userServiceProxy);        // Intercepts /api/users/*   — Step 4
// app.use(swipeServiceProxy);       // Intercepts /api/swipes/*  — Step 5
// app.use(matchServiceProxy);       // Intercepts /api/matches/* — Step 6
// app.use(chatServiceProxy);        // Intercepts /api/chat/*    — Step 7
// app.use(notificationServiceProxy);// Intercepts /api/notifications/* — Step 8

// =============================================================================
// HEALTH CHECK
// Simple endpoint to confirm the gateway itself is running.
// Does not proxy — answers directly from the gateway.
// =============================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// 404 HANDLER
// If no route matched, the request is for something the gateway doesn't know about.
// =============================================================================
app.use((req, res) => {
  res.status(404).json({
    error: `No route found for ${req.method} ${req.path}`,
  });
});

// =============================================================================
// GLOBAL ERROR HANDLER
// Catches any unhandled errors from middleware or proxying.
// =============================================================================
app.use((err, req, res, next) => {
  console.error('[Gateway Error]', err.message);
  res.status(500).json({ error: 'Gateway error. Please try again.' });
});

module.exports = app;
