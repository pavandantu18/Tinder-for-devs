// =============================================================================
// src/app.js — chat-service
//
// IMPORTANT — CORS FOR SOCKET.IO:
//   Socket.IO requires explicit CORS configuration separate from Express CORS.
//   Both are set here and passed to the Socket.IO server in index.js.
//   The frontend origin must be whitelisted or Socket.IO connections will fail.
// =============================================================================

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const chatRoutes = require('./routes/chat.routes');

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app = express();

// CORS config — exported so index.js can pass the same config to Socket.IO
const corsOptions = {
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST'],
  credentials: true,  // Required for Socket.IO with credentials
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

app.use(chatRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = { app, corsOptions };
