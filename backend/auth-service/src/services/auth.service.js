// =============================================================================
// src/services/auth.service.js
// Service: auth-service
//
// PURPOSE:
//   Contains all the business logic for authentication.
//   Controllers call functions here — they don't contain logic themselves.
//
// SEPARATION OF CONCERNS:
//   Controller → handles HTTP (req, res) → calls Service
//   Service    → handles business rules  → calls DB/Kafka/Redis
//   This means if we swap Express for another framework, only controllers change.
//   If we swap PostgreSQL for another DB, only the service changes.
//
// FUNCTIONS EXPORTED:
//   registerUser(email, password) → creates credential, emits user.created
//   loginUser(email, password)    → verifies credentials, returns JWT
//   logoutUser(token)             → blacklists JWT in Redis
//   loginWithGoogle(profile)     → finds or creates user via Google OAuth
// =============================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const { publishEvent } = require('../config/kafka');
const { blacklistToken } = require('../config/redis');

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// bcrypt salt rounds — higher = more secure but slower.
// 12 is a good balance: ~300ms per hash (fast enough for UX, slow enough to
// make brute-forcing impractical). Don't go below 10 in production.
const SALT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// registerUser(email, password)
//
// Registers a new user with email and password.
//
// STEPS:
//   1. Check if email is already taken → 409 Conflict if so
//   2. Hash the password with bcrypt (never store plaintext)
//   3. Insert new row into credentials table
//   4. Publish 'user.created' event to Kafka
//      → User Service will consume this and create a blank profile
//   5. Return the new user's id and email (NOT the password hash)
//
// PARAMS:
//   email    (string) — must be unique in credentials table
//   password (string) — plaintext, will be hashed before storage
//
// RETURNS:
//   { userId, email } on success
//
// THROWS:
//   Error with status 409 if email already exists
// ---------------------------------------------------------------------------
const registerUser = async (email, password) => {
  // Step 1: Check for duplicate email
  // We check first and throw a clear error rather than relying on the
  // UNIQUE constraint error (which is less user-friendly to parse).
  const existing = await query(
    'SELECT id FROM credentials WHERE email = $1',
    [email.toLowerCase()]  // Normalize to lowercase to prevent duplicate accounts
  );

  if (existing.rows.length > 0) {
    const error = new Error('An account with this email already exists');
    error.status = 409; // HTTP 409 Conflict
    throw error;
  }

  // Step 2: Hash the password
  // bcrypt.hash(plaintext, saltRounds) generates a salt, hashes the password,
  // and returns a string like: "$2a$12$<22-char-salt><31-char-hash>"
  // The hash includes the salt, so no separate salt storage is needed.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Step 3: Insert into credentials table
  // uuid_generate_v4() is called by PostgreSQL (via the uuid-ossp extension)
  // to generate the ID — we don't generate it in Node to keep ID generation
  // consistent even if this code is called from multiple instances.
  const result = await query(
    `INSERT INTO credentials (email, password_hash, provider)
     VALUES ($1, $2, 'local')
     RETURNING id, email, created_at`,
    [email.toLowerCase(), passwordHash]
  );

  const newUser = result.rows[0];

  // Step 4: Publish user.created event to Kafka
  // User Service listens to this topic and creates a blank profile
  // when it receives this event. This is async — we don't wait for
  // the User Service to finish before responding to the client.
  await publishEvent('user.created', {
    userId: newUser.id,
    email: newUser.email,
    createdAt: newUser.created_at,
  });

  // Step 5: Return safe user data (never return password_hash)
  return {
    userId: newUser.id,
    email: newUser.email,
  };
};

// ---------------------------------------------------------------------------
// loginUser(email, password)
//
// Verifies credentials and issues a JWT on success.
//
// STEPS:
//   1. Find user by email
//   2. Compare submitted password against stored bcrypt hash
//   3. Generate JWT with userId and email in the payload
//   4. Return the JWT (client stores it and sends it with future requests)
//
// JWT PAYLOAD STRUCTURE:
//   {
//     sub: userId,        — "subject" — standard JWT claim for user ID
//     email: string,      — useful to have in token to avoid DB lookups
//     jti: uuid,          — "JWT ID" — unique per token, used for blacklisting
//     iat: timestamp,     — "issued at" — set automatically by jsonwebtoken
//     exp: timestamp,     — "expires at" — set by expiresIn option
//   }
//
// PARAMS:
//   email    (string) — user's email
//   password (string) — plaintext password to verify
//
// RETURNS:
//   { token, userId, email }
//
// THROWS:
//   Error with status 401 if credentials are invalid
// ---------------------------------------------------------------------------
const loginUser = async (email, password) => {
  // Step 1: Find user by email
  const result = await query(
    'SELECT id, email, password_hash, provider FROM credentials WHERE email = $1',
    [email.toLowerCase()]
  );

  // Use a generic error message — don't reveal whether the email exists
  // (prevents user enumeration attacks where attacker tests many emails)
  const invalidCredsError = new Error('Invalid email or password');
  invalidCredsError.status = 401;

  if (result.rows.length === 0) {
    throw invalidCredsError;
  }

  const user = result.rows[0];

  // Check if this account uses Google OAuth (has no password)
  if (user.provider === 'google' || !user.password_hash) {
    const error = new Error('This account uses Google sign-in. Please log in with Google.');
    error.status = 401;
    throw error;
  }

  // Step 2: Compare submitted password with stored hash
  // bcrypt.compare() hashes the submitted password with the SAME salt
  // that was used when the hash was created, then compares.
  // Returns true if they match, false otherwise.
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw invalidCredsError;
  }

  // Step 3: Generate JWT
  // The JWT is signed with JWT_SECRET — only our servers can create valid tokens.
  // Anyone can READ the payload (it's base64 encoded), but can't FORGE a token
  // without the secret. Never put sensitive data (passwords, full PII) in JWT payload.
  const jti = uuidv4(); // Unique token ID — used for blacklisting on logout

  const token = jwt.sign(
    {
      sub: user.id,       // Subject (user ID)
      email: user.email,
      jti,               // JWT ID — unique per token
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        // Token is valid for 7 days. After that, user must log in again.
        // Shorter = more secure, longer = better UX. 7d is a common default.
    }
  );

  return {
    token,
    userId: user.id,
    email: user.email,
  };
};

// ---------------------------------------------------------------------------
// logoutUser(token)
//
// Blacklists the JWT so it can't be used after logout.
//
// WHY WE NEED THIS:
//   JWTs are stateless — the server doesn't track issued tokens.
//   If we do nothing on logout, the token stays valid until it expires.
//   By adding the token's jti to Redis with a TTL = remaining lifetime,
//   the API Gateway can check "is this token blacklisted?" on every request.
//
// PARAMS:
//   token (string) — the raw JWT string from the Authorization header
//
// HOW TTL IS CALCULATED:
//   Decode the JWT to get the exp (expiry) timestamp.
//   TTL = exp - now (in seconds) = remaining valid time.
//   Set Redis key with that TTL so it auto-expires when the token would expire.
// ---------------------------------------------------------------------------
const logoutUser = async (token) => {
  // Decode without verification (we already verified in middleware)
  // jwt.decode() returns the payload without checking the signature
  const decoded = jwt.decode(token);

  if (!decoded || !decoded.jti || !decoded.exp) {
    const error = new Error('Invalid token format');
    error.status = 400;
    throw error;
  }

  // Calculate how many seconds until this token would naturally expire
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds = decoded.exp - nowInSeconds;

  if (ttlSeconds > 0) {
    // Only blacklist if the token hasn't already expired
    await blacklistToken(decoded.jti, ttlSeconds);
  }
};

// ---------------------------------------------------------------------------
// loginWithGoogle(googleProfile)
//
// Handles Google OAuth login/registration (called by Passport.js callback).
//
// TWO CASES:
//   1. Returning Google user: find by google_id, return existing account
//   2. New Google user: create credentials row (no password), emit user.created
//
// PARAMS:
//   googleProfile (object) — Google profile from Passport:
//     { id, emails: [{ value }], displayName }
//
// RETURNS:
//   { userId, email } — same shape as registerUser
// ---------------------------------------------------------------------------
const loginWithGoogle = async (googleProfile) => {
  const googleId = googleProfile.id;
  const email = googleProfile.emails[0].value.toLowerCase();

  // Check if this Google account already has a DevMatch account
  const existing = await query(
    'SELECT id, email FROM credentials WHERE google_id = $1',
    [googleId]
  );

  if (existing.rows.length > 0) {
    // Returning user — just return their info, no need to emit user.created again
    return {
      userId: existing.rows[0].id,
      email: existing.rows[0].email,
    };
  }

  // New Google user — create their credentials row
  // Also check if their email is taken by a local account
  const emailTaken = await query(
    'SELECT id FROM credentials WHERE email = $1',
    [email]
  );

  if (emailTaken.rows.length > 0) {
    const error = new Error('An account with this email already exists. Please log in with email and password.');
    error.status = 409;
    throw error;
  }

  const result = await query(
    `INSERT INTO credentials (email, google_id, provider)
     VALUES ($1, $2, 'google')
     RETURNING id, email, created_at`,
    [email, googleId]
  );

  const newUser = result.rows[0];

  // Emit user.created so User Service creates a blank profile
  await publishEvent('user.created', {
    userId: newUser.id,
    email: newUser.email,
    createdAt: newUser.created_at,
  });

  return {
    userId: newUser.id,
    email: newUser.email,
  };
};

module.exports = { registerUser, loginUser, logoutUser, loginWithGoogle };
