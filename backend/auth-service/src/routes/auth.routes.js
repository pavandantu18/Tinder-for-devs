// =============================================================================
// src/routes/auth.routes.js
// Service: auth-service
//
// PURPOSE:
//   Defines the URL routes for the Auth Service and wires them to
//   their middleware and controller functions.
//
// ROUTE STRUCTURE:
//   This router is mounted at /api/auth in app.js, so the full paths are:
//     POST   /api/auth/register
//     POST   /api/auth/login
//     POST   /api/auth/logout
//     GET    /api/auth/google
//     GET    /api/auth/google/callback
//     GET    /api/auth/health
//
// HOW EXPRESS ROUTING WORKS:
//   router.post(path, ...middleware, controller)
//   When a request arrives, Express runs each middleware left-to-right.
//   If middleware calls next(), the next function runs.
//   If middleware calls res.json() directly, the chain stops there.
//   The last function in the chain is the controller.
// =============================================================================

const express = require('express');
const passport = require('passport');
const { validateRegister, validateLogin, authenticateToken } = require('../middleware/validate');
const { register, login, logout, googleCallback, healthCheck } = require('../controllers/auth.controller');

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/auth/register
//
// Flow: request → validateRegister → register controller
//
// validateRegister checks: email format, password length
// If validation fails → 400 response (chain stops)
// If validation passes → register controller creates the account
// ---------------------------------------------------------------------------
router.post('/register', validateRegister, register);

// ---------------------------------------------------------------------------
// POST /api/auth/login
//
// Flow: request → validateLogin → login controller
// ---------------------------------------------------------------------------
router.post('/login', validateLogin, login);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
//
// Flow: request → authenticateToken → logout controller
//
// authenticateToken verifies the JWT from the Authorization header.
// If token is missing/invalid/blacklisted → 401 response (chain stops)
// If token is valid → attaches req.user and req.token, then calls logout
// ---------------------------------------------------------------------------
router.post('/logout', authenticateToken, logout);

// ---------------------------------------------------------------------------
// GET /api/auth/google
//
// Initiates the Google OAuth flow.
// passport.authenticate('google', { scope }) does two things:
//   1. Generates the Google OAuth consent URL
//   2. Redirects the user's browser to that URL
//
// scope defines what user data we're requesting from Google:
//   'profile' → name, photo
//   'email'   → email address
// ---------------------------------------------------------------------------
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback
//
// Google redirects here after the user grants/denies permission.
// The URL includes a `code` parameter that Passport exchanges for tokens.
//
// passport.authenticate('google', { session: false }):
//   - Exchanges the code for an access token with Google
//   - Fetches the user's profile
//   - Calls our verify callback (set up in app.js) with the profile
//   - Sets req.user to whatever our callback returns
//   - Then calls next() so googleCallback controller runs
//
// failureRedirect: where to send the user if Google auth fails
// (e.g., user clicked "Deny" on the consent screen)
// ---------------------------------------------------------------------------
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,           // We use JWTs, not server-side sessions
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`,
  }),
  googleCallback              // Only runs if Passport authentication succeeded
);

// ---------------------------------------------------------------------------
// GET /api/auth/health
//
// Health check endpoint — no middleware, just a quick status response.
// Used by Docker Compose healthchecks and monitoring tools.
// ---------------------------------------------------------------------------
router.get('/health', healthCheck);

module.exports = router;
