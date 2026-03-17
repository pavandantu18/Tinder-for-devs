// =============================================================================
// src/controllers/auth.controller.js
// Service: auth-service
//
// PURPOSE:
//   Handles the HTTP layer for authentication requests.
//   Controllers are thin — they extract data from req, call the service,
//   and return a response. Business logic lives in auth.service.js.
//
// CONTROLLER RESPONSIBILITIES:
//   ✓ Extract fields from req.body / req.user / req.token
//   ✓ Call the appropriate service function
//   ✓ Map service results to HTTP responses (status codes + JSON)
//   ✓ Catch service errors and map them to appropriate HTTP error responses
//
// CONTROLLER NON-RESPONSIBILITIES:
//   ✗ Business rules (e.g., password hashing, matching logic)
//   ✗ Database queries
//   ✗ Kafka publishing
//
// ROUTES HANDLED (defined in auth.routes.js):
//   POST   /api/auth/register         → register()
//   POST   /api/auth/login            → login()
//   POST   /api/auth/logout           → logout()
//   GET    /api/auth/google           → googleAuth() (redirect to Google)
//   GET    /api/auth/google/callback  → googleCallback() (Google redirects here)
// =============================================================================

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  registerUser,
  loginUser,
  logoutUser,
  loginWithGoogle,
} = require('../services/auth.service');

// ---------------------------------------------------------------------------
// register(req, res)
//
// Handles POST /api/auth/register
// Creates a new account with email and password.
//
// REQUEST BODY:
//   { email: string, password: string }
//
// SUCCESS RESPONSE — 201 Created:
//   { message: string, userId: string, email: string }
//
// ERROR RESPONSES:
//   400 — Validation failed (handled upstream by validateRegister middleware)
//   409 — Email already taken
//   500 — Unexpected server error
// ---------------------------------------------------------------------------
const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    // req.body.email is already normalized to lowercase by validateRegister middleware

    const result = await registerUser(email, password);

    return res.status(201).json({
      message: 'Account created successfully',
      userId: result.userId,
      email: result.email,
    });
  } catch (err) {
    // Service throws errors with a .status property for known failures
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    // Unknown error — log it, return generic message (don't leak internals)
    console.error('[Controller] register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// login(req, res)
//
// Handles POST /api/auth/login
// Verifies credentials and returns a JWT.
//
// REQUEST BODY:
//   { email: string, password: string }
//
// SUCCESS RESPONSE — 200 OK:
//   { message: string, token: string, userId: string, email: string }
//
// ERROR RESPONSES:
//   401 — Invalid credentials
//   500 — Unexpected server error
// ---------------------------------------------------------------------------
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await loginUser(email, password);

    return res.status(200).json({
      message: 'Login successful',
      token: result.token,
      userId: result.userId,
      email: result.email,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Controller] login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// logout(req, res)
//
// Handles POST /api/auth/logout
// Blacklists the current JWT so it can't be used again.
// This route requires authenticateToken middleware (JWT must be valid).
//
// REQUEST HEADERS:
//   Authorization: Bearer <token>
//
// SUCCESS RESPONSE — 200 OK:
//   { message: string }
//
// ERROR RESPONSES:
//   401 — No token or invalid token (handled by authenticateToken middleware)
//   500 — Unexpected server error
// ---------------------------------------------------------------------------
const logout = async (req, res) => {
  try {
    // req.token is attached by the authenticateToken middleware
    await logoutUser(req.token);

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Controller] logout error:', err.message);
    return res.status(500).json({ error: 'Logout failed. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// googleAuth(req, res)
//
// Handles GET /api/auth/google
// Triggers the Passport Google OAuth flow.
// Passport redirects the user's browser to Google's OAuth consent screen.
// No logic here — Passport handles the redirect automatically.
// The actual handler is in app.js where passport.authenticate() is called.
// ---------------------------------------------------------------------------
const googleAuth = (req, res) => {
  // This controller is intentionally empty.
  // Passport's authenticate middleware intercepts this request,
  // generates the Google OAuth URL, and redirects the browser.
  // The user never actually reaches this function body.
};

// ---------------------------------------------------------------------------
// googleCallback(req, res)
//
// Handles GET /api/auth/google/callback
// Called by Google after the user grants or denies permission.
// Passport verifies the OAuth code, fetches the user profile,
// and calls our verify callback (configured in app.js).
//
// At this point, req.user is set by Passport to the result of our
// verify callback (the { userId, email } from loginWithGoogle).
//
// SUCCESS: Issues a JWT and redirects the client to the frontend with the token.
// FAILURE: Redirects to the login page with an error parameter.
// ---------------------------------------------------------------------------
const googleCallback = async (req, res) => {
  try {
    // req.user is set by Passport after successful OAuth
    // It contains { userId, email } from our Passport verify callback
    const { userId, email } = req.user;

    // Issue a JWT for the Google-authenticated user
    const jti = uuidv4();
    const token = jwt.sign(
      { sub: userId, email, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Redirect to the frontend with the token as a URL parameter.
    // In production, prefer storing the token in an httpOnly cookie instead.
    // For learning purposes, URL redirect is simpler to understand.
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
  } catch (err) {
    console.error('[Controller] googleCallback error:', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};

// ---------------------------------------------------------------------------
// healthCheck(req, res)
//
// Handles GET /health
// Returns service health status. Used by Docker Compose and load balancers
// to check if this service is alive and ready to handle requests.
// ---------------------------------------------------------------------------
const healthCheck = (req, res) => {
  return res.status(200).json({
    service: 'auth-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { register, login, logout, googleAuth, googleCallback, healthCheck };
