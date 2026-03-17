// =============================================================================
// src/api/user.js
// Project: DevMatch Frontend
//
// PURPOSE:
//   All HTTP calls to the User Service.
//   The JWT is attached automatically by the axios interceptor in auth.js
//   (since both use the same `api` instance from auth.js).
//
// All requests go to /api/users/* → proxied by Vite → API Gateway → User Service
// =============================================================================

import axios from 'axios';

// Re-use the same configured axios instance from auth.js
// (has the JWT interceptor and base URL already set up)
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach JWT automatically on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// getMyProfile()
// Fetches the authenticated user's own profile.
// Returns: { profile: { id, name, bio, skills, github_url, photo_url, ... } }
// ---------------------------------------------------------------------------
export const getMyProfile = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

// ---------------------------------------------------------------------------
// updateMyProfile(fields)
// Updates profile fields. Only provided fields are updated.
//
// PARAMS:
//   fields (object) — any subset of:
//     { name, bio, skills (array), github_url, photo_url, age, location }
// ---------------------------------------------------------------------------
export const updateMyProfile = async (fields) => {
  const response = await api.put('/users/me', fields);
  return response.data;
};

// ---------------------------------------------------------------------------
// discoverProfiles(page, limit)
// Returns paginated list of complete developer profiles for the swipe feed.
// ---------------------------------------------------------------------------
export const discoverProfiles = async (page = 1, limit = 10) => {
  const response = await api.get(`/users/discover?page=${page}&limit=${limit}`);
  return response.data;
};

// ---------------------------------------------------------------------------
// getPublicProfile(userId)
// Fetches another user's public profile.
// ---------------------------------------------------------------------------
export const getPublicProfile = async (userId) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};
