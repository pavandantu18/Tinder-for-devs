// =============================================================================
// src/config/redis.js
// Service: api-gateway
//
// PURPOSE:
//   Redis client used by the API Gateway for two things:
//
//   1. RATE LIMITING
//      Tracks how many requests each IP has made in the current time window.
//      Key:   "ratelimit:<ip>:<window>"
//      Value: request count (incremented on each request)
//      TTL:   auto-expires at end of the window
//
//   2. JWT BLACKLIST CHECK
//      Checks if a token has been explicitly revoked (user logged out).
//      Auth Service writes to this blacklist on logout.
//      Gateway reads from it on every protected request.
//      Key:   "blacklist:<jti>"
//      Value: "1" if blacklisted, missing key if still valid
//
// WHY THE GATEWAY DOES BOTH:
//   Every single request passes through the gateway. Doing these checks
//   here means we protect ALL services centrally. Without the gateway,
//   every individual service would need its own rate limiter and blacklist
//   checker — duplicated logic across 6 services.
// =============================================================================

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 500, 30000),
  lazyConnect: false,
});

redis.on('connect', () => console.log('[Redis] Gateway connected to Redis'));
redis.on('error', (err) => console.error('[Redis] Gateway error:', err.message));

// ---------------------------------------------------------------------------
// isTokenBlacklisted(jti)
//
// Returns true if this token's unique ID is in the blacklist.
// Called by the auth middleware on every protected request.
//
// PARAMS:
//   jti (string) — the JWT's "jti" claim (set by auth-service on login)
// ---------------------------------------------------------------------------
const isTokenBlacklisted = async (jti) => {
  const result = await redis.get(`blacklist:${jti}`);
  return result !== null; // null = key doesn't exist = token is valid
};

// ---------------------------------------------------------------------------
// checkRateLimit(ip, limitPerWindow, windowMs)
//
// Implements a fixed-window rate limiter using Redis INCR + EXPIRE.
//
// HOW IT WORKS:
//   Each request increments a counter keyed by IP + current time window.
//   The window is calculated by integer-dividing the current timestamp
//   by the window size (e.g., every 60 seconds = a new window).
//
//   First request in a window: counter = 1, TTL set to windowMs
//   Nth request in a window:   counter = N, TTL unchanged
//   If N > limit: reject with 429 Too Many Requests
//   When window expires: Redis auto-deletes the key, counter resets to 0
//
// PARAMS:
//   ip            (string) — client's IP address
//   limitPerWindow (number) — max requests allowed per window
//   windowMs      (number) — window duration in milliseconds
//
// RETURNS:
//   { allowed: boolean, remaining: number, resetInMs: number }
// ---------------------------------------------------------------------------
const checkRateLimit = async (ip, limitPerWindow = 100, windowMs = 60000) => {
  // Calculate which time window we're currently in.
  // Math.floor(now / windowMs) gives the same value for all requests
  // within the same window, and changes to a new value each new window.
  const windowId = Math.floor(Date.now() / windowMs);
  const key = `ratelimit:${ip}:${windowId}`;

  // INCR atomically increments the counter and returns the new value.
  // If the key doesn't exist, Redis creates it with value 0 before incrementing.
  // Atomicity is important — concurrent requests won't lose increments.
  const count = await redis.incr(key);

  if (count === 1) {
    // First request in this window — set the TTL so it auto-expires.
    // Convert ms to seconds (EXPIRE takes seconds).
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }

  const remaining = Math.max(0, limitPerWindow - count);
  const windowResetMs = (windowId + 1) * windowMs - Date.now();

  return {
    allowed: count <= limitPerWindow,
    remaining,
    resetInMs: windowResetMs,
  };
};

module.exports = { redis, isTokenBlacklisted, checkRateLimit };
