// =============================================================================
// src/middleware/rateLimit.js
// Service: api-gateway
//
// PURPOSE:
//   Express middleware that enforces rate limiting on every incoming request.
//   Prevents a single client from flooding the system with requests
//   (accidental or malicious).
//
// HOW IT WORKS:
//   1. Extract the client's IP address from the request
//   2. Call checkRateLimit() which increments a Redis counter for this IP
//   3. If under the limit → add rate limit headers and call next()
//   4. If over the limit  → return 429 Too Many Requests
//
// RATE LIMIT HEADERS (added to every response):
//   X-RateLimit-Limit     — max requests allowed per window
//   X-RateLimit-Remaining — how many requests the client has left
//   X-RateLimit-Reset     — when the window resets (Unix timestamp in seconds)
//
// These headers are the standard way to communicate rate limit status.
// Clients can read them to know when to back off.
// =============================================================================

const { checkRateLimit } = require('../config/redis');

// Max requests per window per IP — adjust as needed
const LIMIT_PER_WINDOW = 100;

// Window size — 60 seconds (1 minute)
const WINDOW_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// rateLimitMiddleware(req, res, next)
//
// Applied to all routes in app.js before any proxying happens.
// ---------------------------------------------------------------------------
const rateLimitMiddleware = async (req, res, next) => {
  try {
    // Get the real client IP.
    // req.ip works for direct connections.
    // X-Forwarded-For is set by load balancers/proxies when sitting in front.
    // We take the first IP in X-Forwarded-For (the original client, not proxies).
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

    const { allowed, remaining, resetInMs } = await checkRateLimit(
      ip,
      LIMIT_PER_WINDOW,
      WINDOW_MS
    );

    // Add informational headers to every response
    // so clients can see their current rate limit status
    res.setHeader('X-RateLimit-Limit', LIMIT_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil((Date.now() + resetInMs) / 1000) // Unix timestamp of next window
    );

    if (!allowed) {
      // Client has exceeded the limit — return 429 with Retry-After header
      // Retry-After tells the client how many seconds to wait before retrying
      return res.status(429).json({
        error: 'Too many requests. Please slow down.',
        retryAfterSeconds: Math.ceil(resetInMs / 1000),
      });
    }

    next();
  } catch (err) {
    // If Redis is down, don't block all traffic — fail open and log the error.
    // In production you might want to fail closed (block all traffic) for security.
    console.error('[RateLimit] Redis error, skipping rate limit check:', err.message);
    next();
  }
};

module.exports = rateLimitMiddleware;
