-- =============================================================================
-- src/db/init.sql
-- Service: user-service
-- Database: user_db
--
-- PURPOSE:
--   Creates the profiles table for the User Service.
--   A profile row is created (blank) when Auth Service emits user.created.
--   The developer then fills in their profile via PUT /api/users/me.
--
-- RELATIONSHIP TO AUTH DB:
--   profiles.id = credentials.id (same UUID, different databases).
--   There is NO foreign key between them — services don't share databases.
--   Consistency is maintained via the Kafka event (user.created).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: profiles
--
-- One row per registered user. Created blank when user.created is consumed.
-- All columns except id are nullable — the user fills them in after registration.
--
-- COLUMNS:
--   id          — Same UUID as auth_db credentials.id. Set from Kafka event payload.
--   name        — Developer's display name shown on swipe cards.
--   bio         — Short description of themselves (max 500 chars).
--   skills      — PostgreSQL TEXT ARRAY. e.g. ARRAY['React','Node.js','Go']
--                 Stored natively as an array — no separate join table needed.
--   github_url  — Link to GitHub profile.
--   photo_url   — Profile picture URL (uploaded to S3/Cloudinary in production).
--   age         — Developer's age (optional).
--   location    — City/country (optional, used for proximity matching later).
--   is_complete — true once the user has filled in name + at least one skill.
--                 Used to filter out incomplete profiles from /discover.
--   created_at  — When the profile row was created (from Kafka event).
--   updated_at  — Last time any field was updated.
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID         PRIMARY KEY,
  name         VARCHAR(100),
  bio          TEXT,
  skills       TEXT[]       DEFAULT ARRAY[]::TEXT[],
  github_url   TEXT,   -- TEXT instead of VARCHAR(255) — URLs can exceed 255 chars (S3, Cloudinary)
  photo_url    TEXT,   -- TEXT has no length limit in PostgreSQL, no performance difference
  age          INTEGER      CHECK (age >= 18 AND age <= 100),
  location     VARCHAR(100),
  is_complete  BOOLEAN      DEFAULT false,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- MIGRATIONS
-- ALTER TABLE statements run every startup but are safe (IF NOT EXISTS / idempotent).
-- Needed when the table already exists from a previous run with old column types.
-- =============================================================================

-- Widen URL columns to TEXT in case they were created as VARCHAR(255)
ALTER TABLE profiles ALTER COLUMN github_url TYPE TEXT;
ALTER TABLE profiles ALTER COLUMN photo_url  TYPE TEXT;

-- Index for fast profile lookup by id (already covered by PRIMARY KEY)
-- Additional index for discover query — filter by is_complete, sort by created_at
CREATE INDEX IF NOT EXISTS idx_profiles_discover
  ON profiles(is_complete, created_at DESC)
  WHERE is_complete = true;

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON profiles;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
