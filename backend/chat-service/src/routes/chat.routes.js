// =============================================================================
// src/routes/chat.routes.js — chat-service
//
// ROUTES:
//   GET /health                                — health check
//   GET /api/chat/rooms/:matchId/messages      — fetch message history
// =============================================================================

const express = require('express');
const { getMessages, healthCheck } = require('../controllers/chat.controller');

const router = express.Router();

router.get('/health', healthCheck);
router.get('/api/chat/rooms/:matchId/messages', getMessages);

module.exports = router;
