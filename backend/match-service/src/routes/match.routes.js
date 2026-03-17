// =============================================================================
// src/routes/match.routes.js — match-service
//
// ROUTES:
//   GET /health          — health check
//   GET /api/matches     — list authenticated user's matches (with profile data)
// =============================================================================

const express = require('express');
const { getMatches, healthCheck } = require('../controllers/match.controller');

const router = express.Router();

router.get('/health',      healthCheck);
router.get('/api/matches', getMatches);

module.exports = router;
