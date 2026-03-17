// =============================================================================
// src/api/auth.js
// Project: DevMatch Frontend
//
// PURPOSE:
//   All HTTP calls to the Auth Service live here.
//   Components never call axios directly — they import functions from this file.
//
// WHY CENTRALISE API CALLS:
//   If the API URL or request format changes, we update one file, not every
//   component that makes that call. It also makes the code easier to read —
//   a component calling `loginUser(email, password)` is clearer than a
//   component containing raw axios config.
//
// BASE URL:
//   Requests go to /api/... which Vite's proxy (vite.config.js) forwards to
//   http://localhost:3001 in development.
//   In Step 3, the proxy target changes to the API Gateway (port 3000) —
//   no changes needed in this file.
// =============================================================================

import axios from 'axios';

// Create an axios instance with shared config.
// All functions in this file use this instance instead of raw axios.
const api = axios.create({
  baseURL: '/api',
    // All requests are relative to /api — e.g. post('/auth/login') hits /api/auth/login
    // Vite proxy forwards /api/* to the backend.

  headers: {
    'Content-Type': 'application/json',
  },

  timeout: 10000, // 10 second timeout — fail fast if the server is unreachable
});

// ---------------------------------------------------------------------------
// Request interceptor — attach JWT to every request automatically
//
// Instead of manually adding the Authorization header in every function,
// this interceptor runs before every request and adds the token if one exists.
//
// Flow: api.post('/auth/logout') → interceptor adds header → request sent
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 globally
//
// If any request gets a 401 (Unauthorized), the token is expired or invalid.
// Clear storage and redirect to login so the user re-authenticates.
// This handles the case where a stored token expires while the app is open.
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response, // Pass successful responses through unchanged
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired — clear local state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login (only if not already there, to avoid a redirect loop)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// register(email, password)
//
// Creates a new DevMatch account.
//
// PARAMS:
//   email    (string) — user's email address
//   password (string) — must be at least 8 characters
//
// RETURNS:
//   { message, userId, email } on success
//
// THROWS:
//   axios error — caller should catch and read error.response.data.error
// ---------------------------------------------------------------------------
export const register = async (email, password) => {
  const response = await api.post('/auth/register', { email, password });
  return response.data;
};

// ---------------------------------------------------------------------------
// login(email, password)
//
// Authenticates and returns a JWT.
//
// RETURNS:
//   { message, token, userId, email }
//   The token should be stored in localStorage by the caller (AuthContext).
// ---------------------------------------------------------------------------
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// ---------------------------------------------------------------------------
// logout()
//
// Blacklists the current JWT on the server side.
// The Authorization header is attached automatically by the request interceptor.
// ---------------------------------------------------------------------------
export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};
