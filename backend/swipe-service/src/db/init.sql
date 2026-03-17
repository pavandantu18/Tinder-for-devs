-- =============================================================================
-- src/db/init.sql
-- Service: swipe-service
-- Database: swipe_db
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: swipes
--
-- Records every swipe action in the system.
-- One row = one swipe decision (LIKE or PASS).
--
-- COLUMNS:
--   id          — unique swipe record ID
--   swiper_id   — UUID of the user who swiped
--   target_id   — UUID of the user who was swiped on
--   direction   — 'LIKE' or 'PASS'
--   created_at  — when the swipe happened
--
-- UNIQUE(swiper_id, target_id):
--   A user can only swipe on a given profile once.
--   If they try again, the DB rejects it with a unique violation.
--   The service catches this and returns a 409 Conflict.
--   This also prevents duplicate match creation — even if the client
--   sends the same swipe twice, only one row is ever stored.
-- =============================================================================
CREATE TABLE IF NOT EXISTS swipes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id   UUID        NOT NULL,
  target_id   UUID        NOT NULL,
  direction   VARCHAR(4)  NOT NULL CHECK (direction IN ('LIKE', 'PASS')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_swipe UNIQUE (swiper_id, target_id)
);

-- Index: fast lookup of "did swiper_id already swipe on target_id?"
-- Used by CheckMutualLike gRPC — called by Match Service on every LIKE
CREATE INDEX IF NOT EXISTS idx_swipes_lookup
  ON swipes(swiper_id, target_id, direction);

-- Index: fast lookup of all profiles a user has swiped on
-- Used by GetSwipedUserIds gRPC — called by User Service for /discover filtering
CREATE INDEX IF NOT EXISTS idx_swipes_by_swiper
  ON swipes(swiper_id);
