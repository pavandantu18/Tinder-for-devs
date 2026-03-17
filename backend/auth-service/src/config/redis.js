// =============================================================================
// src/config/redis.js
// Service: auth-service
//
// PURPOSE:
//   Creates and exports a Redis client for the Auth Service.
//   Redis is used here specifically for JWT blacklisting (logout).
//
// THE LOGOUT PROBLEM WITH JWTs:
//   JWTs are stateless — once issued, they're valid until they expire.
//   There's no built-in "revoke this token" mechanism.
//   If a user logs out, their token is still technically valid until expiry.
//
// THE SOLUTION — JWT BLACKLIST:
//   When a user logs out, we store the token's unique ID (jti claim) in Redis
//   with a TTL equal to the token's remaining lifetime.
//
//   Every protected request → API Gateway checks Redis:
//     "Is this token's jti in the blacklist?"
//     YES → Reject (401 Unauthorized)
//     NO  → Allow through
//
//   After the token expires naturally, Redis auto-deletes the blacklist entry
//   (via TTL), so the blacklist never grows unboundedly.
//
// WHY REDIS FOR THIS:
//   - O(1) key lookup — checking a single key is near-instant
//   - TTL support built-in — entries auto-expire when the token would expire anyway
//   - In-memory — much faster than a database query for every request
// =============================================================================

const Redis = require('ioredis');

// Create the Redis client.
// ioredis auto-reconnects on disconnect — you don't need to manage that.
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
    // 'redis' is the Docker container name — resolves via Docker DNS.

  port: parseInt(process.env.REDIS_PORT || '6379'),
    // Default Redis port.

  password: process.env.REDIS_PASSWORD,
    // Set in .env. Redis rejects commands if the wrong password is provided.

  retryStrategy: (times) => {
    // Called each time a reconnection attempt is made.
    // Returns the delay (ms) to wait before the next attempt.
    // Math.min caps the delay at 30 seconds to avoid infinite waits.
    const delay = Math.min(times * 500, 30000);
    console.log(`[Redis] Reconnecting... attempt ${times}, waiting ${delay}ms`);
    return delay;
  },

  lazyConnect: false,
    // Connect immediately when the client is created (not on first command).
    // We want to know about connection failures at startup.
});

// Log successful connection
redis.on('connect', () => {
  console.log('[Redis] Connected to Redis server');
});

// Log reconnection events
redis.on('reconnecting', () => {
  console.warn('[Redis] Connection lost — attempting to reconnect...');
});

// Log errors (ioredis handles reconnection automatically — these are informational)
redis.on('error', (err) => {
  console.error('[Redis] Client error:', err.message);
});

// ---------------------------------------------------------------------------
// blacklistToken(jti, ttlSeconds)
//
// Adds a JWT's unique ID to the blacklist with an expiry time.
// After ttlSeconds, Redis automatically deletes this key.
//
// PARAMS:
//   jti        (string) — The JWT's "jti" claim (unique token ID)
//   ttlSeconds (number) — How many seconds until this entry expires
//                         Should match the token's remaining lifetime
//
// REDIS COMMAND USED:
//   SET blacklist:<jti> "1" EX <ttlSeconds>
//   "1" is just a placeholder value — we only care whether the key exists
// ---------------------------------------------------------------------------
const blacklistToken = async (jti, ttlSeconds) => {
  await redis.set(`blacklist:${jti}`, '1', 'EX', ttlSeconds);
  console.log(`[Redis] Token blacklisted: jti=${jti}, expires in ${ttlSeconds}s`);
};

// ---------------------------------------------------------------------------
// isTokenBlacklisted(jti)
//
// Checks if a JWT's jti is in the blacklist.
// Returns true if the token has been revoked (user logged out).
//
// PARAMS:
//   jti (string) — The JWT's "jti" claim to check
//
// RETURNS:
//   boolean — true if blacklisted, false if valid
// ---------------------------------------------------------------------------
const isTokenBlacklisted = async (jti) => {
  const result = await redis.get(`blacklist:${jti}`);
  // result is "1" if key exists (blacklisted), null if key doesn't exist (valid)
  return result !== null;
};

module.exports = { redis, blacklistToken, isTokenBlacklisted };
