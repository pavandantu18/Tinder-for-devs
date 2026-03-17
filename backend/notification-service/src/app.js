// =============================================================================
// src/app.js — notification-service
// =============================================================================

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const notificationRoutes = require('./routes/notification.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(notificationRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
