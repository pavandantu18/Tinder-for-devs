-- =============================================================================
-- src/db/init.sql
-- Service: auth-service
-- Database: auth_db
--
-- PURPOSE:
--   Creates the database schema for the Auth Service.
--   This file runs once on service startup (via initDatabase() in index.js).
--   All statements use IF NOT EXISTS so re-running is always safe.
--
-- WHAT LIVES HERE:
--   The Auth Service owns exactly one concern: identity.
--   "Who are you?" → answered by the credentials table.
--   Profile data (name, bio, skills) lives in the User Service DB, not here.
--
-- HOW IT RUNS:
--   index.js reads this file and executes it against auth_db using the pg pool.
--   This happens before the Express server starts accepting requests.
-- =============================================================================

-- Enable the uuid-ossp extension so we can call uuid_generate_v4().
-- UUIDs are better than auto-increment integers for distributed systems because:
--   - They're globally unique across services (no collision if we merge DBs)
--   - They don't expose record count (sequential IDs reveal "user #1042 exists")
--   - Services can generate IDs client-side without a DB round-trip
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: credentials
--
-- Stores one row per registered user.
-- This is the ONLY table the Auth Service owns.
--
-- COLUMNS:
--   id             — The user's permanent unique identifier.
--                    This same UUID is shared with the User Service,
--                    Swipe Service, etc. — it's the system-wide user ID.
--
--   email          — Used for login. Unique constraint prevents duplicate accounts.
--                    Stored lowercase to prevent "User@Email.com" vs "user@email.com"
--                    being treated as different accounts (enforced at app layer).
--
--   password_hash  — bcrypt hash of the user's password.
--                    NEVER store plaintext passwords.
--                    bcrypt hashes include the salt — no separate salt column needed.
--                    NULL is allowed for Google OAuth users (they have no password).
--
--   google_id      — Google's unique user ID for OAuth logins.
--                    NULL for email/password users.
--                    When a user logs in with Google, we look them up by this field.
--
--   provider       — How this account was created: 'local' or 'google'.
--                    Helps decide which auth flow to use on login.
--
--   created_at     — When the account was registered. Set automatically.
--   updated_at     — When the account was last modified. Updated automatically.
-- =============================================================================
CREATE TABLE IF NOT EXISTS credentials (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255),
  google_id      VARCHAR(255) UNIQUE,
  provider       VARCHAR(50)  NOT NULL DEFAULT 'local',
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEX: idx_credentials_email
--
-- Speeds up the most common query in Auth Service:
--   SELECT * FROM credentials WHERE email = $1
--
-- Without an index, PostgreSQL scans every row to find a match (O(n)).
-- With a B-tree index on email, it finds the row in O(log n).
-- Since login is called on every authentication, this index is critical.
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_credentials_email ON credentials(email);

-- =============================================================================
-- INDEX: idx_credentials_google_id
--
-- Speeds up Google OAuth lookup:
--   SELECT * FROM credentials WHERE google_id = $1
--
-- Called during the Google OAuth callback when we check if this Google account
-- already has a DevMatch account, or if we need to create one.
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_credentials_google_id ON credentials(google_id);

-- =============================================================================
-- FUNCTION + TRIGGER: update_updated_at
--
-- Automatically updates the updated_at column whenever a row is modified.
-- Without this, we'd have to remember to set updated_at manually in every UPDATE.
--
-- HOW IT WORKS:
--   1. The function returns NEW (the updated row) with updated_at set to NOW()
--   2. The trigger fires BEFORE every UPDATE on the credentials table
--   3. PostgreSQL uses the returned NEW row (with the fresh timestamp) as the update
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists (so re-running this file doesn't error)
DROP TRIGGER IF EXISTS set_updated_at ON credentials;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
