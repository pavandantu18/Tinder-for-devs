// =============================================================================
// src/controllers/user.controller.js
// Service: user-service
//
// PURPOSE:
//   HTTP handlers for user profile endpoints.
//   Thin layer — extracts data from req, calls service, returns response.
//
// ROUTES HANDLED:
//   GET  /api/users/me          → getMyProfile
//   PUT  /api/users/me          → updateMyProfile
//   GET  /api/users/discover    → discoverProfiles
//   GET  /api/users/:id         → getProfileById
// =============================================================================

const {
  getProfileById,
  updateMyProfile,
  discoverProfiles,
} = require('../services/user.service');

// ---------------------------------------------------------------------------
// getMyProfile — GET /api/users/me
//
// Returns the authenticated user's own profile.
// req.userId is set by requireUserId middleware (from X-User-Id header).
// ---------------------------------------------------------------------------
const getMyProfile = async (req, res) => {
  try {
    // autoCreate=true — if the profile row is missing (e.g. Kafka event was
    // published before user-service was running), create it on the fly.
    const profile = await getProfileById(req.userId, true);

    return res.status(200).json({ profile });
  } catch (err) {
    console.error('[Controller] getMyProfile error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

// ---------------------------------------------------------------------------
// updateProfile — PUT /api/users/me
//
// Updates the authenticated user's profile fields.
// Only fields included in the request body are updated.
// ---------------------------------------------------------------------------
const updateProfile = async (req, res) => {
  try {
    const updated = await updateMyProfile(req.userId, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile: updated,
    });
  } catch (err) {
    console.error('[Controller] updateProfile error:', err.message);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

// ---------------------------------------------------------------------------
// discover — GET /api/users/discover
//
// Returns paginated list of complete profiles to show in the swipe feed.
// Query params: ?page=1&limit=10
// ---------------------------------------------------------------------------
const discover = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await discoverProfiles(req.userId, page, limit);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Controller] discover error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch profiles.' });
  }
};

// ---------------------------------------------------------------------------
// getPublicProfile — GET /api/users/:id
//
// Returns another user's public profile (used for swipe cards, match details).
// ---------------------------------------------------------------------------
const getPublicProfile = async (req, res) => {
  try {
    const profile = await getProfileById(req.params.id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // Return only public fields — never expose internal flags
    const { id, name, bio, skills, github_url, photo_url, age, location } = profile;
    return res.status(200).json({ profile: { id, name, bio, skills, github_url, photo_url, age, location } });
  } catch (err) {
    console.error('[Controller] getPublicProfile error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

module.exports = { getMyProfile, updateProfile, discover, getPublicProfile };
