// =============================================================================
// src/routes/swipe.routes.js — swipe-service
//
// ROUTES:
//   GET  /health        — health check (no auth needed)
//   POST /api/swipes    — record a LIKE or PASS
//   GET  /api/swipes/me — return the user's swiped profile IDs
// =============================================================================

const express = require('express');
const { requireUserId, validateSwipe } = require('../middleware/validate');
const { postSwipe, getMySwipes, healthCheck } = require('../controllers/swipe.controller');

const router = express.Router();

// Public health check — used by Docker healthcheck + load balancers
router.get('/health', healthCheck);

// POST /api/swipes — record a swipe
// requireUserId first: ensure X-User-Id is present
// validateSwipe:       ensure direction is LIKE or PASS and targetId is provided
router.post('/api/swipes', requireUserId, validateSwipe, postSwipe);

// GET /api/swipes/me — return IDs of all profiles this user has swiped on
router.get('/api/swipes/me', requireUserId, getMySwipes);

module.exports = router;
