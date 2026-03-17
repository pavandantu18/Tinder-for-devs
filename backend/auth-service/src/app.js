// =============================================================================
// src/app.js
// Service: auth-service
//
// PURPOSE:
//   Creates and configures the Express application.
//   This file is responsible for:
//     - Setting up global middleware (CORS, JSON parsing, logging)
//     - Configuring Passport for Google OAuth
//     - Mounting route handlers
//     - Registering the global error handler
//
// WHY SEPARATE FROM index.js:
//   index.js handles startup (DB connection, Kafka connection, server.listen).
//   app.js handles the Express configuration.
//   This separation makes the app easier to test — you can import app.js
//   in tests without starting a real server or connecting to real services.
// =============================================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { loginWithGoogle } = require('./services/auth.service');
const authRoutes = require('./routes/auth.routes');

const app = express();

// =============================================================================
// MIDDLEWARE
// Middleware runs on EVERY request before reaching any route handler.
// Order matters — middleware is applied top-to-bottom.
// =============================================================================

// ---------------------------------------------------------------------------
// CORS (Cross-Origin Resource Sharing)
//
// By default, browsers block requests from one origin (e.g., localhost:5173)
// to a different origin (e.g., localhost:3000). This is the Same-Origin Policy.
// CORS headers tell the browser: "this server allows requests from these origins".
//
// In production, replace '*' with your exact frontend domain.
// ---------------------------------------------------------------------------
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
    // '*' allows any origin — fine for development, too permissive for production

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // HTTP methods this server accepts from cross-origin requests

  allowedHeaders: ['Content-Type', 'Authorization'],
    // Headers the client is allowed to send
    // 'Authorization' is needed for JWT-bearing requests
}));

// ---------------------------------------------------------------------------
// express.json()
//
// Parses incoming requests with JSON bodies and makes the parsed data
// available at req.body. Without this, req.body is undefined.
//
// limit: '10kb' — reject bodies larger than 10KB to prevent DoS attacks
// where an attacker sends massive payloads to exhaust memory.
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// morgan — HTTP request logger
//
// Logs every incoming request in the format:
//   POST /api/auth/login 200 45ms
//
// 'dev' format: colorized, concise output good for development.
// In production, use 'combined' format (Apache log format) for log aggregation.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ---------------------------------------------------------------------------
// Passport initialization
//
// Passport is an authentication middleware for Node.js.
// passport.initialize() adds req.logIn and req.logOut methods to every request.
// We're using it here ONLY for Google OAuth — not for session management.
// ---------------------------------------------------------------------------
app.use(passport.initialize());

// =============================================================================
// PASSPORT GOOGLE STRATEGY
//
// Configures how Passport handles the Google OAuth flow.
//
// HOW PASSPORT OAUTH WORKS:
//   1. User hits GET /api/auth/google
//   2. Passport generates Google OAuth URL and redirects user's browser
//   3. User grants permission on Google
//   4. Google redirects browser to callbackURL with an auth code
//   5. Passport exchanges the auth code for a Google access token
//   6. Passport calls Google's userinfo API to fetch the user's profile
//   7. Passport calls our verify callback (the async function below)
//   8. Our callback calls loginWithGoogle() to find/create the DevMatch account
//   9. done(null, user) sets req.user = user for the next middleware
// =============================================================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
        // Must exactly match an Authorized redirect URI in Google Cloud Console
    },
    // Verify callback: called after Google provides the user's profile
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create a DevMatch account for this Google profile
        const user = await loginWithGoogle(profile);

        // done(error, user):
        //   done(null, user)  → success, Passport sets req.user = user
        //   done(null, false) → auth failed (user denied, etc.)
        //   done(err)         → error occurred
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// =============================================================================
// ROUTES
// Mount all auth routes under /api/auth prefix.
// =============================================================================

// All routes defined in auth.routes.js are prefixed with /api/auth
// e.g., router.post('/login') becomes POST /api/auth/login
app.use('/api/auth', authRoutes);

// Root health check — confirms the service is running (no auth needed)
app.get('/health', (req, res) => {
  res.status(200).json({ service: 'auth-service', status: 'healthy' });
});

// =============================================================================
// GLOBAL ERROR HANDLER
//
// Express calls this middleware when any route handler calls next(err)
// or throws an unhandled error.
//
// SIGNATURE: (err, req, res, next) — four parameters distinguishes it
// from regular middleware. Express only routes to this if err is present.
//
// This is the last line of defence — any error that wasn't caught in
// a controller ends up here.
// =============================================================================
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err.stack || err.message);

  // Use the error's status if set (e.g., from service layer), otherwise 500
  const statusCode = err.status || 500;
  const message = statusCode === 500
    ? 'An unexpected error occurred'   // Don't leak internal details on 500s
    : err.message;

  res.status(statusCode).json({ error: message });
});

// =============================================================================
// 404 HANDLER
//
// If no route matched the request, return a 404.
// This must come AFTER all route definitions.
// =============================================================================
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

module.exports = app;
