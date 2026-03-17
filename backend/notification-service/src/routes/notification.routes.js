// =============================================================================
// src/routes/notification.routes.js — notification-service
//
// ROUTES:
//   GET /health                        — health check
//   GET /api/notifications/stream      — SSE stream (real-time push)
//   GET /api/notifications/count       — unread badge count
//   GET /api/notifications             — notification history
//   PUT /api/notifications/read        — mark all as read
// =============================================================================

const express = require('express');
const {
  sseStream, getAll, getCount, markRead, healthCheck,
} = require('../controllers/notification.controller');

const router = express.Router();

router.get('/health', healthCheck);

// SSE must be before /:id routes to avoid being matched as an id param
router.get('/api/notifications/stream', sseStream);
router.get('/api/notifications/count',  getCount);
router.get('/api/notifications',        getAll);
router.put('/api/notifications/read',   markRead);

module.exports = router;
