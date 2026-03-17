// =============================================================================
// src/api/swipe.js
//
// API client for the Swipe Service.
// All requests go through /api (proxied by Vite → API Gateway → Swipe Service).
//
// FUNCTIONS:
//   recordSwipe(targetId, direction) — POST /api/swipes — send a LIKE or PASS
//   getMySwipes()                    — GET  /api/swipes/me — get swiped profile IDs
// =============================================================================

import axios from 'axios';

// Axios instance — mirrors the one in auth.js and user.js.
// Attaches the JWT from localStorage before every request.
const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// recordSwipe(targetId, direction)
//
// Records a LIKE or PASS swipe on a profile.
//
// PARAMS:
//   targetId  (string) — UUID of the profile being swiped on
//   direction (string) — 'LIKE' or 'PASS'
//
// RETURNS: { swipe: { id, swiperId, targetId, direction, createdAt } }
// THROWS:  409 if already swiped on this profile
// ---------------------------------------------------------------------------
export const recordSwipe = async (targetId, direction) => {
  const response = await api.post('/swipes', { targetId, direction });
  return response.data;
};

// ---------------------------------------------------------------------------
// getMySwipes()
//
// Returns all user IDs the current user has already swiped on.
//
// RETURNS: { swipedUserIds: string[] }
// ---------------------------------------------------------------------------
export const getMySwipes = async () => {
  const response = await api.get('/swipes/me');
  return response.data;
};
