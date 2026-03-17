-- =============================================================================
-- src/db/init.sql
-- Service: match-service
-- Database: match_db
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: matches
--
-- One row = one confirmed mutual match between two users.
--
-- COLUMNS:
--   id        — unique match UUID
--   user1_id  — the user with the lexicographically LOWER UUID
--   user2_id  — the user with the lexicographically HIGHER UUID
--   created_at — when the match was confirmed
--
-- WHY user1_id IS ALWAYS THE LOWER UUID:
--   A match between Alice and Bob is the same as a match between Bob and Alice.
--   To prevent duplicate rows, we always store the smaller UUID as user1_id.
--   This makes the UNIQUE constraint work correctly:
--     UNIQUE(user1_id, user2_id) prevents the same pair from matching twice,
--     regardless of which user triggered the mutual like.
--
--   When querying: always pass (min(a,b), max(a,b)) as (user1_id, user2_id).
--
-- IDEMPOTENCY:
--   ON CONFLICT DO NOTHING prevents duplicate matches even if the Kafka
--   consumer delivers the same swipe.created event more than once.
-- =============================================================================
CREATE TABLE IF NOT EXISTS matches (
  id         UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id   UUID  NOT NULL,
  user2_id   UUID  NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_match UNIQUE (user1_id, user2_id),
  CONSTRAINT ordered_ids  CHECK (user1_id < user2_id)
    -- Enforces that user1_id is always the smaller UUID.
    -- Prevents storing the same pair in both orders.
);

-- Index: look up all matches for a given user
-- Used by GET /api/matches — "show me all my matches"
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id);
