// =============================================================================
// src/app.js — swipe-service
//
// Express application setup.
// Kept separate from index.js so it can be tested without starting the server.
// =============================================================================

const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');

const swipeRoutes = require('./routes/swipe.routes');

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS — during development allow all origins.
// In production, restrict to the frontend domain.
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// HTTP request logging — 'dev' format: METHOD URL STATUS RESPONSE-TIME
app.use(morgan('dev'));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(swipeRoutes);

// ---------------------------------------------------------------------------
// 404 handler — catch-all for unmatched routes
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Global error handler
// Catches any error passed via next(err) from route handlers
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

module.exports = app;
