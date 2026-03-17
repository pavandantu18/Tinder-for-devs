// =============================================================================
// src/app.js — match-service
// =============================================================================

const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');

const matchRoutes = require('./routes/match.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use(matchRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

module.exports = app;
