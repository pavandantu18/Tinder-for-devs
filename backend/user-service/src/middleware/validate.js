// =============================================================================
// src/middleware/validate.js
// Service: user-service
//
// PURPOSE:
//   Validates incoming requests before they reach the controller.
//
// FUNCTIONS:
//   validateProfileUpdate — validates PUT /api/users/me body
//   requireUserId         — ensures X-User-Id header is present (set by gateway)
// =============================================================================

// ---------------------------------------------------------------------------
// requireUserId
//
// Every protected route in user-service reads the current user from the
// X-User-Id header injected by the API Gateway after JWT verification.
// If this header is missing, the request didn't come through the gateway
// properly — reject it.
// ---------------------------------------------------------------------------
const requireUserId = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      error: 'Missing user identity. Request must pass through the API Gateway.',
    });
  }
  // Attach to req for easy access in controllers
  req.userId = userId;
  next();
};

// ---------------------------------------------------------------------------
// validateProfileUpdate
//
// Validates PUT /api/users/me request body.
// All fields are optional (PATCH semantics — only update what's provided).
// Validates types and lengths for fields that are present.
// ---------------------------------------------------------------------------
const validateProfileUpdate = (req, res, next) => {
  const { name, bio, skills, github_url, photo_url, age, location } = req.body;
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push('name must be a non-empty string');
    } else if (name.trim().length > 100) {
      errors.push('name must be 100 characters or fewer');
    }
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      errors.push('bio must be a string');
    } else if (bio.length > 500) {
      errors.push('bio must be 500 characters or fewer');
    }
  }

  if (skills !== undefined) {
    // skills must be an array of strings
    if (!Array.isArray(skills)) {
      errors.push('skills must be an array of strings');
    } else if (skills.some((s) => typeof s !== 'string')) {
      errors.push('each skill must be a string');
    } else if (skills.length > 20) {
      errors.push('maximum 20 skills allowed');
    }
  }

  if (github_url !== undefined && github_url !== null && github_url !== '') {
    if (typeof github_url !== 'string' || !github_url.startsWith('https://github.com/')) {
      errors.push('github_url must start with https://github.com/');
    }
  }

  if (age !== undefined && age !== null) {
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
      errors.push('age must be between 18 and 100');
    }
    req.body.age = ageNum; // Normalize to integer
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // Trim string fields
  if (name)     req.body.name     = name.trim();
  if (location) req.body.location = location.trim();

  next();
};

module.exports = { requireUserId, validateProfileUpdate };
