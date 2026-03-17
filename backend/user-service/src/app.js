// =============================================================================
// src/app.js
// Service: user-service
//
// PURPOSE:
//   Express app configuration — middleware and route mounting.
// =============================================================================

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const userRoutes = require('./routes/user.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Mount user routes — all paths here become /api/users/*
// (the /api/users prefix is added by the API Gateway routing)
app.use('/api/users', userRoutes);

// Root health check
app.get('/health', (req, res) => {
  res.status(200).json({ service: 'user-service', status: 'healthy' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
