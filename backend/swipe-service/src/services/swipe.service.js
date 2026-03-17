// =============================================================================
// src/services/swipe.service.js — swipe-service
//
// FUNCTIONS:
//   recordSwipe(swiperId, targetId, direction) — save swipe, emit Kafka event
//   checkMutualLike(swiperId, targetId)        — used by gRPC (Match Service)
//   getSwipedUserIds(userId)                   — used by gRPC (User Service)
// =============================================================================

const { query } = require('../config/db');
const { publishSwipeCreated } = require('../config/kafka');

// ---------------------------------------------------------------------------
// recordSwipe(swiperId, targetId, direction)
//
// Saves a LIKE or PASS to the swipes table and emits swipe.created to Kafka.
//
// DUPLICATE HANDLING:
//   The UNIQUE(swiper_id, target_id) constraint prevents double-swipes.
//   ON CONFLICT DO NOTHING silently ignores duplicates and returns null,
//   so the controller can return 409 without crashing.
//
// RETURNS: the created swipe row, or null if it already existed
// ---------------------------------------------------------------------------
const recordSwipe = async (swiperId, targetId, direction) => {
  const result = await query(
    `INSERT INTO swipes (swiper_id, target_id, direction)
     VALUES ($1, $2, $3)
     ON CONFLICT (swiper_id, target_id) DO NOTHING
     RETURNING id, swiper_id, target_id, direction, created_at`,
    [swiperId, targetId, direction]
  );

  if (result.rows.length === 0) {
    // Row already existed — user already swiped on this profile
    return null;
  }

  const swipe = result.rows[0];

  // Emit Kafka event — Match Service listens for LIKE swipes
  await publishSwipeCreated({
    swipeId:   swipe.id,
    swiperId:  swipe.swiper_id,
    targetId:  swipe.target_id,
    direction: swipe.direction,
    createdAt: swipe.created_at,
  });

  return swipe;
};

// ---------------------------------------------------------------------------
// checkMutualLike(swiperId, targetId)
//
// Called by Match Service via gRPC when User A likes User B.
// Checks: "Has User B already liked User A?"
// If yes → mutual match.
//
// PARAMS:
//   swiperId — the user who just swiped LIKE (User A)
//   targetId — the user being swiped on (User B)
//
// Checks if targetId has a LIKE record where they swiped on swiperId.
// i.e., swiper_id = targetId AND target_id = swiperId AND direction = 'LIKE'
// ---------------------------------------------------------------------------
const checkMutualLike = async (swiperId, targetId) => {
  const result = await query(
    `SELECT id FROM swipes
     WHERE swiper_id = $1
       AND target_id = $2
       AND direction = 'LIKE'`,
    [targetId, swiperId]
    // Note: swiperId and targetId are REVERSED intentionally.
    // We're checking if the TARGET has previously liked the SWIPER.
  );
  return result.rows.length > 0;
};

// ---------------------------------------------------------------------------
// getSwipedUserIds(userId)
//
// Returns all UUIDs that userId has already swiped on (LIKE or PASS).
// Called by User Service via gRPC to filter these out of /discover.
// ---------------------------------------------------------------------------
const getSwipedUserIds = async (userId) => {
  const result = await query(
    `SELECT target_id FROM swipes WHERE swiper_id = $1`,
    [userId]
  );
  return result.rows.map((row) => row.target_id);
};

module.exports = { recordSwipe, checkMutualLike, getSwipedUserIds };
