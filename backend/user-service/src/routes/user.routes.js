// =============================================================================
// src/routes/user.routes.js
// Service: user-service
//
// PURPOSE:
//   Wires URL routes to middleware and controllers.
//   Mounted at /api/users in app.js.
//
// FULL PATHS (after gateway routes to this service):
//   GET  /api/users/me          → requireUserId → getMyProfile
//   PUT  /api/users/me          → requireUserId → validateProfileUpdate → updateProfile
//   GET  /api/users/discover    → requireUserId → discover
//   GET  /api/users/:id         → requireUserId → getPublicProfile
//
// NOTE ON ROUTE ORDER:
//   /discover and /me must be defined BEFORE /:id.
//   Express matches routes top-to-bottom. If /:id came first,
//   a request to /me would match it with id='me' — wrong behaviour.
// =============================================================================

const express = require('express');
const { requireUserId, validateProfileUpdate } = require('../middleware/validate');
const { getMyProfile, updateProfile, discover, getPublicProfile } = require('../controllers/user.controller');

const router = express.Router();

// Health check — no auth needed
router.get('/health', (req, res) => {
  res.status(200).json({ service: 'user-service', status: 'healthy' });
});

// My own profile — must come before /:id
router.get('/me',  requireUserId, getMyProfile);
router.put('/me',  requireUserId, validateProfileUpdate, updateProfile);

// Discovery feed — profiles to swipe on
router.get('/discover', requireUserId, discover);

// Any other user's public profile — must come LAST (catches /api/users/<uuid>)
router.get('/:id', requireUserId, getPublicProfile);

module.exports = router;
