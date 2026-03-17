// =============================================================================
// src/middleware/auth.js
// Service: api-gateway
//
// PURPOSE:
//   JWT verification middleware for protected routes.
//   Runs BEFORE the request is proxied to a downstream service.
//
// WHAT IT DOES:
//   1. Extracts JWT from the "Authorization: Bearer <token>" header
//   2. Verifies the token's signature using JWT_SECRET
//   3. Checks the token's jti against the Redis blacklist (logout check)
//   4. Injects the authenticated user's ID and email as request headers
//      so downstream services know who is making the request
//   5. Calls next() to continue to the proxy
//
// WHY INJECT HEADERS INSTEAD OF FORWARDING THE TOKEN:
//   Downstream services could verify the JWT themselves, but that means
//   every service needs JWT_SECRET and blacklist check logic — duplicated
//   across 6 services. Instead, the gateway verifies once and injects:
//     X-User-Id:    the authenticated user's UUID
//     X-User-Email: the authenticated user's email
//   Services trust these headers because requests only reach them via
//   the gateway (they're not exposed to the internet directly).
//
// PUBLIC ROUTES (skip this middleware):
//   POST /api/auth/register
//   POST /api/auth/login
//   GET  /api/auth/google
//   GET  /api/auth/google/callback
//   GET  /health
// =============================================================================

const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../config/redis');

// ---------------------------------------------------------------------------
// PUBLIC_ROUTES
//
// List of routes that don't require authentication.
// Each entry is { method, path } where path can be an exact string or regex.
//
// We check these BEFORE running JWT verification so unauthenticated
// users can still register and log in.
// ---------------------------------------------------------------------------
const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET',  path: '/api/auth/google' },
  { method: 'GET',  path: '/api/auth/google/callback' },
  { method: 'GET',  path: '/health' },
];

// ---------------------------------------------------------------------------
// isPublicRoute(method, path)
//
// Returns true if the request matches one of the public routes above.
// Google OAuth callback has a dynamic query string (?code=...&state=...),
// so we check startsWith instead of exact match for that route.
// ---------------------------------------------------------------------------
const isPublicRoute = (method, path) => {
  return PUBLIC_ROUTES.some((route) => {
    const methodMatch = route.method === method;
    // Use startsWith for the Google callback because the URL has query params
    const pathMatch = path === route.path || path.startsWith(route.path + '?');
    return methodMatch && pathMatch;
  });
};

// ---------------------------------------------------------------------------
// authenticate(req, res, next)
//
// The actual middleware function. Applied to all routes in app.js.
// Skips verification for public routes; enforces JWT for everything else.
// ---------------------------------------------------------------------------
const authenticate = async (req, res, next) => {
  // Skip auth check for public routes (login, register, Google OAuth)
  if (isPublicRoute(req.method, req.path)) {
    return next();
  }

  // Extract token from "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required. Please log in.',
    });
  }

  try {
    // Verify the token signature and expiry.
    // jwt.verify() throws if the token is tampered with or expired.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { sub: userId, email, jti, iat, exp }

    // Check Redis blacklist — was this token revoked on logout?
    const blacklisted = await isTokenBlacklisted(decoded.jti);
    if (blacklisted) {
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
      });
    }

    // Inject user identity as headers so downstream services can trust them.
    // Services read X-User-Id to know which user is making the request,
    // without needing to verify the JWT themselves.
    req.headers['x-user-id'] = decoded.sub;
    req.headers['x-user-email'] = decoded.email;

    // Remove the raw Authorization header before forwarding.
    // Downstream services should use X-User-Id, not the JWT directly.
    // This also prevents services from trying to re-verify an already-verified token.
    // COMMENT THIS OUT if a downstream service explicitly needs the raw JWT.
    // delete req.headers['authorization'];

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired. Please log in again.',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token.',
      });
    }
    console.error('[Auth Middleware] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Authentication error.' });
  }
};

module.exports = authenticate;
