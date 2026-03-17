// =============================================================================
// src/api/match.js
//
// API client for the Match Service.
// =============================================================================

import axios from 'axios';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// getMatches(page, limit)
// Returns the current user's matches enriched with profile data.
// Response: { matches: [{id, createdAt, user: {id, name, photo_url, skills}}], total, page, totalPages }
export const getMatches = async (page = 1, limit = 20) => {
  const response = await api.get(`/matches?page=${page}&limit=${limit}`);
  return response.data;
};

// Fetch a single match by id (used when navigating from a notification)
export const getMatch = async (matchId) => {
  const { matches } = await getMatches(1, 100);
  return matches.find((m) => m.id === matchId) || null;
};
