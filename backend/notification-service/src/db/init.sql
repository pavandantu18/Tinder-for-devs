-- =============================================================================
-- src/db/init.sql — notification-service
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: notifications
--
-- One row = one notification for one user.
--
-- COLUMNS:
--   id         — unique notification UUID
--   user_id    — the user this notification belongs to
--   type       — 'new_match' | 'new_message'
--   title      — short heading shown in the bell panel
--   body       — longer description
--   data       — JSON blob with context (matchId, senderId, etc.)
--   is_read    — false until the user opens the notification
--   created_at — when the event happened
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID      NOT NULL,
  type       VARCHAR(32) NOT NULL,
  title      TEXT      NOT NULL,
  body       TEXT      NOT NULL DEFAULT '',
  data       JSONB     NOT NULL DEFAULT '{}',
  is_read    BOOLEAN   NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fast lookup: all notifications for a user, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);

-- Fast unread count
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;
