// =============================================================================
// src/controllers/swipe.controller.js — swipe-service
//
// HTTP handlers for swipe actions.
//
// HANDLERS:
//   postSwipe   — POST /api/swipes  — record a LIKE or PASS
//   getMySwipes — GET  /api/swipes/me — return user's swipe history
// =============================================================================

const { recordSwipe, getSwipedUserIds } = require('../services/swipe.service');

// ---------------------------------------------------------------------------
// postSwipe
//
// Records a LIKE or PASS swipe from the authenticated user.
//
// FLOW:
//   1. Read swiperId from X-User-Id header (injected by API Gateway)
//   2. Read targetId + direction from request body
//   3. Insert into swipes table (duplicate = 409)
//   4. Kafka event emitted inside recordSwipe()
//
// RESPONSES:
//   201 — swipe saved successfully
//   409 — user already swiped on this profile (duplicate)
//   500 — unexpected error
// ---------------------------------------------------------------------------
const postSwipe = async (req, res) => {
  try {
    const swiperId  = req.userId;               // set by requireUserId middleware
    const { targetId, direction } = req.body;   // validated by validateSwipe middleware

    const swipe = await recordSwipe(swiperId, targetId, direction);

    if (swipe === null) {
      // Duplicate swipe — ON CONFLICT DO NOTHING returned no rows
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already swiped on this profile',
      });
    }

    return res.status(201).json({
      message: 'Swipe recorded',
      swipe: {
        id:        swipe.id,
        swiperId:  swipe.swiper_id,
        targetId:  swipe.target_id,
        direction: swipe.direction,
        createdAt: swipe.created_at,
      },
    });
  } catch (err) {
    console.error('[Controller] postSwipe error:', err.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
};

// ---------------------------------------------------------------------------
// getMySwipes
//
// Returns all user IDs the authenticated user has swiped on.
// Useful for the frontend to know which profiles have been acted on.
// ---------------------------------------------------------------------------
const getMySwipes = async (req, res) => {
  try {
    const swipedIds = await getSwipedUserIds(req.userId);
    return res.status(200).json({ swipedUserIds: swipedIds });
  } catch (err) {
    console.error('[Controller] getMySwipes error:', err.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
};

// ---------------------------------------------------------------------------
// healthCheck
// ---------------------------------------------------------------------------
const healthCheck = (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'swipe-service' });
};

module.exports = { postSwipe, getMySwipes, healthCheck };
