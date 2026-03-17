// =============================================================================
// src/api/chat.js
//
// REST API client for chat message history.
// WebSocket connection is managed separately in useChatSocket.js
// =============================================================================

import axios from 'axios';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// getMessages(matchId, limit, before)
// Fetches message history for a chat room.
// before = ISO timestamp for cursor-based pagination (load older messages)
export const getMessages = async (matchId, limit = 50, before = null) => {
  const params = new URLSearchParams({ limit });
  if (before) params.set('before', before);
  const response = await api.get(`/chat/rooms/${matchId}/messages?${params}`);
  return response.data;
};
