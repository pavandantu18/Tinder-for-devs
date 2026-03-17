// =============================================================================
// src/middleware/validate.js — swipe-service
//
// REQUEST VALIDATION MIDDLEWARE
//
// requireUserId  — reads X-User-Id header injected by the API Gateway.
//                  The Gateway verifies the JWT and forwards user identity
//                  as headers, so services never touch raw tokens.
//
// validateSwipe  — ensures direction is exactly 'LIKE' or 'PASS'.
//                  The DB has a CHECK constraint too, but validating early
//                  gives a cleaner 400 error instead of a 500 DB error.
// =============================================================================

// ---------------------------------------------------------------------------
// requireUserId
//
// Every swipe request must come through the API Gateway which injects
// X-User-Id from the verified JWT. If this header is missing, the request
// bypassed auth — reject it immediately.
// ---------------------------------------------------------------------------
const requireUserId = (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-User-Id header. Request must pass through API Gateway.',
    });
  }

  // Attach to req for easy access in controllers
  req.userId = userId;
  next();
};

// ---------------------------------------------------------------------------
// validateSwipe
//
// Body must contain:
//   targetId  — UUID of the profile being swiped on
//   direction — exactly 'LIKE' or 'PASS'
// ---------------------------------------------------------------------------
const VALID_DIRECTIONS = new Set(['LIKE', 'PASS']);

const validateSwipe = (req, res, next) => {
  const { targetId, direction } = req.body;

  if (!targetId) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'targetId is required',
    });
  }

  if (!direction) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'direction is required',
    });
  }

  if (!VALID_DIRECTIONS.has(direction)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'direction must be LIKE or PASS',
    });
  }

  // Prevent self-swipe
  if (targetId === req.userId) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Cannot swipe on yourself',
    });
  }

  next();
};

module.exports = { requireUserId, validateSwipe };
