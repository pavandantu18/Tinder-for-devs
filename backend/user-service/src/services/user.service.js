// =============================================================================
// src/services/user.service.js
// Service: user-service
//
// PURPOSE:
//   All business logic for user profiles.
//   Called by controllers (HTTP) and the Kafka consumer.
//
// FUNCTIONS:
//   createBlankProfile(userId, email)   — called when user.created Kafka event arrives
//   getProfileById(userId)              — fetch any profile by UUID
//   getMyProfile(userId)                — same as above, alias for clarity
//   updateMyProfile(userId, fields)     — update profile fields, set is_complete flag
//   discoverProfiles(userId, page, limit) — paginated list of complete profiles (not self)
// =============================================================================

const { query } = require('../config/db');

// ---------------------------------------------------------------------------
// createBlankProfile(userId, email)
//
// Creates a blank profile row when a new user registers.
// Called by the Kafka consumer when user.created event arrives.
//
// WHY INSERT OR IGNORE:
//   The Kafka consumer uses at-least-once delivery — in rare cases (consumer
//   restart mid-batch) the same event can be delivered twice. ON CONFLICT
//   DO NOTHING makes the operation idempotent — safe to run multiple times.
//
// PARAMS:
//   userId (string) — UUID from the Kafka event (matches auth_db credentials.id)
//   email  (string) — stored for reference (not shown publicly)
// ---------------------------------------------------------------------------
const createBlankProfile = async (userId, email) => {
  await query(
    `INSERT INTO profiles (id)
     VALUES ($1)
     ON CONFLICT (id) DO NOTHING`,
    [userId]
  );
  console.log(`[UserService] Blank profile created for userId: ${userId}`);
};

// ---------------------------------------------------------------------------
// getProfileById(userId, autoCreate)
//
// Fetches a single profile by UUID.
//
// autoCreate (default false):
//   If true and the profile doesn't exist, creates a blank one first.
//   Used by getMyProfile() to handle the race condition where:
//     - User registers → user.created Kafka event published
//     - user-service was down / hadn't started consuming yet
//     - Event was missed, no profile row created
//   With autoCreate=true, the first GET /api/users/me self-heals by
//   inserting the blank profile on demand.
// ---------------------------------------------------------------------------
const getProfileById = async (userId, autoCreate = false) => {
  const result = await query(
    `SELECT id, name, bio, skills, github_url, photo_url, age, location, is_complete, created_at
     FROM profiles
     WHERE id = $1`,
    [userId]
  );

  if (!result.rows[0] && autoCreate) {
    // Profile missing — create it now and return the blank row
    await createBlankProfile(userId);
    return getProfileById(userId); // fetch the newly created row
  }

  return result.rows[0] || null;
};

// ---------------------------------------------------------------------------
// updateMyProfile(userId, fields)
//
// Updates a user's own profile. Only updates fields that are provided —
// missing fields in the request body are left unchanged (PATCH semantics).
//
// PARAMS:
//   userId (string) — from X-User-Id header (set by API gateway)
//   fields (object) — { name, bio, skills, github_url, photo_url, age, location }
//                     Any subset of these can be provided.
//
// is_complete FLAG:
//   Set to true once name is set AND at least one skill is added.
//   is_complete=true profiles appear in /discover for other users to swipe on.
//   This prevents blank profiles from cluttering the discovery feed.
//
// DYNAMIC SQL:
//   We build the SET clause dynamically based on which fields are provided.
//   This avoids overwriting fields that weren't included in the request.
// ---------------------------------------------------------------------------
const updateMyProfile = async (userId, fields) => {
  const { name, bio, skills, github_url, photo_url, age, location } = fields;

  // Build SET clause dynamically — only update provided fields
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (name        !== undefined) { setClauses.push(`name = $${paramIndex++}`);        values.push(name); }
  if (bio         !== undefined) { setClauses.push(`bio = $${paramIndex++}`);         values.push(bio); }
  if (skills      !== undefined) { setClauses.push(`skills = $${paramIndex++}`);      values.push(skills); }
  if (github_url  !== undefined) { setClauses.push(`github_url = $${paramIndex++}`);  values.push(github_url); }
  if (photo_url   !== undefined) { setClauses.push(`photo_url = $${paramIndex++}`);   values.push(photo_url); }
  if (age         !== undefined) { setClauses.push(`age = $${paramIndex++}`);         values.push(age); }
  if (location    !== undefined) { setClauses.push(`location = $${paramIndex++}`);    values.push(location); }

  if (setClauses.length === 0) {
    // Nothing to update — return current profile unchanged
    return getProfileById(userId);
  }

  // After updating, recalculate is_complete:
  // A profile is complete if it has a name AND at least one skill.
  // We use a subquery to check the updated state of the row.
  setClauses.push(
    `is_complete = (
      CASE WHEN (
        COALESCE($${paramIndex++}, name) IS NOT NULL AND
        array_length(COALESCE($${paramIndex++}::TEXT[], skills), 1) > 0
      ) THEN true ELSE false END
    )`
  );
  // Pass name and skills again for the is_complete subquery
  values.push(name !== undefined ? name : null);
  values.push(skills !== undefined ? skills : null);

  values.push(userId); // WHERE clause param

  const result = await query(
    `UPDATE profiles
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, bio, skills, github_url, photo_url, age, location, is_complete`,
    values
  );

  return result.rows[0] || null;
};

// ---------------------------------------------------------------------------
// discoverProfiles(userId, page, limit)
//
// Returns a paginated list of complete profiles for the swipe feed.
// Excludes the current user's own profile.
//
// In Step 5 (Swipe Service), this will be enhanced to also exclude
// profiles the user has already swiped on.
//
// PARAMS:
//   userId (string) — current user's UUID (excluded from results)
//   page   (number) — 1-indexed page number
//   limit  (number) — results per page (max 20)
//
// RETURNS:
//   { profiles: [...], total: N, page: N, totalPages: N }
// ---------------------------------------------------------------------------
const discoverProfiles = async (userId, page = 1, limit = 10) => {
  // Cap limit at 20 to prevent huge result sets
  const safePage  = Math.max(1, parseInt(page));
  const safeLimit = Math.min(20, Math.max(1, parseInt(limit)));
  const offset    = (safePage - 1) * safeLimit;

  // Get total count for pagination metadata
  const countResult = await query(
    `SELECT COUNT(*) FROM profiles
     WHERE id != $1 AND is_complete = true`,
    [userId]
  );
  const total = parseInt(countResult.rows[0].count);

  // Fetch the page of profiles
  const result = await query(
    `SELECT id, name, bio, skills, github_url, photo_url, age, location
     FROM profiles
     WHERE id != $1
       AND is_complete = true
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, offset]
  );

  return {
    profiles: result.rows,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
};

module.exports = {
  createBlankProfile,
  getProfileById,
  updateMyProfile,
  discoverProfiles,
};
