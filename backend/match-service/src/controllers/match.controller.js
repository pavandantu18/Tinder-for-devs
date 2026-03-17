// =============================================================================
// src/controllers/match.controller.js — match-service
//
// HANDLERS:
//   getMatches   — GET /api/matches      — list all matches with profile data
//   healthCheck  — GET /health
// =============================================================================

const { getMatchesForUser } = require('../services/match.service');
const { getMultipleProfiles } = require('../grpc/userClient');

// ---------------------------------------------------------------------------
// getMatches
//
// Returns the authenticated user's matches, enriched with profile data.
//
// FLOW:
//   1. Fetch match records from match_db (just IDs + timestamps)
//   2. Collect all matchedUserIds
//   3. Call User Service via gRPC to get profile data for those IDs
//   4. Merge: attach profile to each match record
//
// WHY GRPC FOR PROFILE DATA:
//   Match Service doesn't store profile data — that's User Service's domain.
//   gRPC is faster than HTTP for internal service calls and strongly typed.
// ---------------------------------------------------------------------------
const getMatches = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;

    // 1. Fetch match records
    const { matches, total, totalPages } = await getMatchesForUser(userId, page, limit);

    if (matches.length === 0) {
      return res.status(200).json({ matches: [], total: 0, page, totalPages: 0 });
    }

    // 2. Collect the IDs of matched users
    const matchedUserIds = matches.map((m) => m.matchedUserId);

    // 3. Fetch profile data for all matched users in one gRPC call
    let profiles = [];
    try {
      profiles = await getMultipleProfiles(matchedUserIds);
    } catch (err) {
      // Non-fatal — return matches without profile data if User Service is down
      console.warn('[Controller] getMultipleProfiles gRPC failed:', err.message);
    }

    // Build a quick lookup map: userId → profile
    const profileMap = {};
    profiles.forEach((p) => { profileMap[p.id] = p; });

    // 4. Merge profile into each match
    const enrichedMatches = matches.map((match) => ({
      id:        match.id,
      createdAt: match.createdAt,
      user: profileMap[match.matchedUserId] || { id: match.matchedUserId },
    }));

    return res.status(200).json({
      matches: enrichedMatches,
      total,
      page,
      totalPages,
    });

  } catch (err) {
    console.error('[Controller] getMatches error:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};

const healthCheck = (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'match-service' });
};

module.exports = { getMatches, healthCheck };
