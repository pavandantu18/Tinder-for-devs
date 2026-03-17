// =============================================================================
// src/services/match.service.js — match-service
//
// FUNCTIONS:
//   processSwipe(swipe)           — Kafka handler: check mutual like → create match
//   createMatch(user1Id, user2Id) — insert match row + emit match.created
//   getMatchesForUser(userId)     — return all match records for a user
//   checkMatchExists(u1, u2)      — used by gRPC server (Chat Service)
// =============================================================================

const { query } = require('../config/db');
const { checkMutualLike } = require('../grpc/swipeClient');
const { publishMatchCreated } = require('../config/kafka');

// ---------------------------------------------------------------------------
// processSwipe(swipe)
//
// Called by the Kafka consumer for every swipe.created event.
//
// FLOW:
//   1. Only process LIKE swipes — PASS swipes can never create a match
//   2. Call CheckMutualLike on Swipe Service:
//      "Has targetId already liked swiperId?"
//   3. If yes → createMatch(swiperId, targetId)
//
// IDEMPOTENCY:
//   createMatch uses ON CONFLICT DO NOTHING, so replaying the same event
//   (e.g., on consumer restart with fromBeginning: true) is safe.
// ---------------------------------------------------------------------------
const processSwipe = async (swipe) => {
  const { swiperId, targetId, direction } = swipe;

  // Only LIKE swipes can trigger a match
  if (direction !== 'LIKE') return;

  console.log(`[MatchService] Processing LIKE: ${swiperId} → ${targetId}`);

  try {
    // Ask Swipe Service: has targetId already liked swiperId?
    const isMutual = await checkMutualLike(swiperId, targetId);

    if (isMutual) {
      console.log(`[MatchService] Mutual like detected! ${swiperId} ↔ ${targetId}`);
      await createMatch(swiperId, targetId);
    }
  } catch (err) {
    console.error('[MatchService] processSwipe error:', err.message);
    throw err; // Re-throw so Kafka consumer knows the message failed
  }
};

// ---------------------------------------------------------------------------
// createMatch(userAId, userBId)
//
// Inserts a match row and emits match.created to Kafka.
//
// ORDERING:
//   We always store user1_id = min(a, b), user2_id = max(a, b).
//   This ensures the UNIQUE constraint catches duplicates regardless of
//   which user was the "swiper" and which was the "target".
//
// RETURNS: the created match row, or null if it already existed
// ---------------------------------------------------------------------------
const createMatch = async (userAId, userBId) => {
  // Enforce consistent ordering: smaller UUID always goes in user1_id
  const user1Id = userAId < userBId ? userAId : userBId;
  const user2Id = userAId < userBId ? userBId : userAId;

  const result = await query(
    `INSERT INTO matches (user1_id, user2_id)
     VALUES ($1, $2)
     ON CONFLICT (user1_id, user2_id) DO NOTHING
     RETURNING id, user1_id, user2_id, created_at`,
    [user1Id, user2Id]
  );

  if (result.rows.length === 0) {
    // Already matched — duplicate Kafka event or race condition
    console.log(`[MatchService] Match already exists for ${user1Id} ↔ ${user2Id}`);
    return null;
  }

  const match = result.rows[0];

  // Emit match.created — Chat Service creates a room, Notification Service fires
  await publishMatchCreated({
    matchId:   match.id,
    user1Id:   match.user1_id,
    user2Id:   match.user2_id,
    createdAt: match.created_at,
  });

  return match;
};

// ---------------------------------------------------------------------------
// getMatchesForUser(userId, page, limit)
//
// Returns paginated match records for a user.
// Match records contain only IDs — callers enrich with profile data separately.
//
// RETURNS: { matches: [{id, matchedUserId, createdAt}], total, page, totalPages }
// ---------------------------------------------------------------------------
const getMatchesForUser = async (userId, page = 1, limit = 20) => {
  const safePage  = Math.max(1, parseInt(page));
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit)));
  const offset    = (safePage - 1) * safeLimit;

  // Count total matches (user appears as either user1 or user2)
  const countResult = await query(
    `SELECT COUNT(*) FROM matches
     WHERE user1_id = $1 OR user2_id = $1`,
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);

  // Fetch the page — derive matchedUserId (the other person in the match)
  const result = await query(
    `SELECT
       id,
       CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END AS matched_user_id,
       created_at
     FROM matches
     WHERE user1_id = $1 OR user2_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, offset]
  );

  return {
    matches: result.rows.map((row) => ({
      id:            row.id,
      matchedUserId: row.matched_user_id,
      createdAt:     row.created_at,
    })),
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
};

// ---------------------------------------------------------------------------
// checkMatchExists(user1Id, user2Id)
//
// Used by the gRPC server (Chat Service calls this).
// Returns the match row if it exists, or null.
//
// ORDER-INDEPENDENT: normalises the pair before querying.
// ---------------------------------------------------------------------------
const checkMatchExists = async (userAId, userBId) => {
  const user1Id = userAId < userBId ? userAId : userBId;
  const user2Id = userAId < userBId ? userBId : userAId;

  const result = await query(
    `SELECT id, user1_id, user2_id, created_at
     FROM matches
     WHERE user1_id = $1 AND user2_id = $2`,
    [user1Id, user2Id]
  );

  return result.rows[0] || null;
};

module.exports = { processSwipe, createMatch, getMatchesForUser, checkMatchExists };
