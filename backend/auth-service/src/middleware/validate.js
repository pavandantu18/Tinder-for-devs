// =============================================================================
// src/middleware/validate.js
// Service: auth-service
//
// PURPOSE:
//   Express middleware functions that validate and sanitize incoming requests
//   before they reach the controller.
//
// WHY VALIDATE IN MIDDLEWARE:
//   Controllers should focus on coordinating business logic, not on checking
//   whether the email is formatted correctly. Middleware handles the "gate" —
//   if the request is malformed, it's rejected here with a clear error before
//   any business logic runs.
//
// MIDDLEWARE PATTERN:
//   A middleware function has signature: (req, res, next)
//   - Call next()         → pass control to the next middleware or controller
//   - Call res.status().json() → reject the request right here
//
// FUNCTIONS EXPORTED:
//   validateRegister    — checks email + password for POST /register
//   validateLogin       — checks email + password for POST /login
//   authenticateToken   — verifies JWT for protected routes
// =============================================================================

const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../config/redis');

// ---------------------------------------------------------------------------
// validateRegister
//
// Validates POST /register request body.
// Expects: { email, password }
//
// RULES:
//   - email must be present and match a basic email pattern
//   - password must be at least 8 characters
//   - Both fields must be strings (prevents prototype pollution attacks)
// ---------------------------------------------------------------------------
const validateRegister = (req, res, next) => {
  const { email, password } = req.body;

  // Check both fields exist and are strings
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      error: 'Email is required',
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      error: 'Password is required',
    });
  }

  // Basic email format check using regex
  // This is a simple check — not RFC 5321 compliant, but catches obvious errors
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      error: 'Please provide a valid email address',
    });
  }

  // Password length — 8 characters minimum
  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long',
    });
  }

  // Sanitize: trim whitespace from email (not password — spaces may be intentional)
  req.body.email = email.trim().toLowerCase();

  // All checks passed — pass to controller
  next();
};

// ---------------------------------------------------------------------------
// validateLogin
//
// Validates POST /login request body.
// Expects: { email, password }
//
// Less strict than register (no length check) because we want the service
// layer to give the "invalid credentials" error, not the validation layer.
// This prevents leaking information about what's wrong.
// ---------------------------------------------------------------------------
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({
      error: 'Email is required',
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      error: 'Password is required',
    });
  }

  // Normalize email
  req.body.email = email.trim().toLowerCase();

  next();
};

// ---------------------------------------------------------------------------
// authenticateToken
//
// Verifies the JWT on protected routes (e.g., POST /logout).
//
// HOW JWT AUTH WORKS:
//   1. Client logs in → receives a JWT
//   2. Client stores the JWT (localStorage or memory)
//   3. Client sends the JWT in every request header:
//        Authorization: Bearer <token>
//   4. This middleware extracts and verifies the token
//   5. If valid, attaches decoded payload to req.user and calls next()
//   6. If invalid/expired/blacklisted, returns 401
//
// The API Gateway also does JWT verification for downstream services.
// We verify here too for routes that the Auth Service itself protects
// (like logout) — defence in depth.
// ---------------------------------------------------------------------------
const authenticateToken = async (req, res, next) => {
  // Extract token from "Authorization: Bearer <token>" header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
    // authHeader.split(' ') → ['Bearer', '<token>']
    // [1] → the token part

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
    });
  }

  try {
    // Verify the token's signature and expiry using our secret
    // If the token is tampered with or expired, jwt.verify() throws
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // decoded = { sub: userId, email, jti, iat, exp }

    // Check Redis blacklist — was this token explicitly revoked (logout)?
    const blacklisted = await isTokenBlacklisted(decoded.jti);
    if (blacklisted) {
      return res.status(401).json({
        error: 'Token has been revoked. Please log in again.',
      });
    }

    // Attach the decoded payload to req.user so downstream handlers can use it
    // e.g., req.user.sub → the authenticated user's ID
    req.user = decoded;
    req.token = token; // Also attach the raw token (needed for logout blacklisting)

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
    // Unexpected error (e.g., Redis connection issue)
    console.error('[Auth Middleware] Token verification error:', err.message);
    return res.status(500).json({
      error: 'Authentication error. Please try again.',
    });
  }
};

module.exports = { validateRegister, validateLogin, authenticateToken };
