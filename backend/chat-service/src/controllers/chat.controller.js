// =============================================================================
// src/controllers/chat.controller.js — chat-service
//
// HTTP handlers for chat REST endpoints.
//
// WHY HTTP IN ADDITION TO WEBSOCKETS:
//   WebSockets handle real-time delivery, but HTTP is better for:
//   - Fetching history on page load (before socket connects)
//   - Fetching older messages (pagination / scroll-up to load more)
//   - Simple status checks
// =============================================================================

const { getRoomMessages } = require('../services/chat.service');

// ---------------------------------------------------------------------------
// getMessages
//
// GET /api/chat/rooms/:matchId/messages
//
// Returns paginated message history for a chat room.
// The frontend calls this to populate the chat before the WebSocket connects,
// or when the user scrolls up to load older messages.
//
// QUERY PARAMS:
//   limit  — how many messages (default 50, max 100)
//   before — ISO timestamp cursor — return messages older than this
// ---------------------------------------------------------------------------
const getMessages = async (req, res) => {
  try {
    const userId  = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { matchId } = req.params;
    const { limit, before } = req.query;

    const messages = await getRoomMessages(matchId, limit, before);

    return res.status(200).json({ messages });
  } catch (err) {
    console.error('[Controller] getMessages error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// healthCheck
// ---------------------------------------------------------------------------
const healthCheck = (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'chat-service' });
};

module.exports = { getMessages, healthCheck };
