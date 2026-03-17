// =============================================================================
// src/services/chat.service.js — chat-service
//
// FUNCTIONS:
//   saveMessage(roomId, senderId, text) — persist a message to MongoDB
//   getRoomMessages(roomId, limit)      — fetch message history for a room
//   getUserRooms(userId, matchIds)      — list rooms the user has access to
// =============================================================================

const Message = require('../models/message.model');

// ---------------------------------------------------------------------------
// saveMessage(roomId, senderId, text)
//
// Persists a message to MongoDB and returns the saved document.
// Called by the Socket.IO handler after auth verification.
// ---------------------------------------------------------------------------
const saveMessage = async (roomId, senderId, text, type = 'text') => {
  const message = new Message({ roomId, senderId, text, type });
  await message.save();
  return message;
};

// ---------------------------------------------------------------------------
// getRoomMessages(roomId, limit, before)
//
// Returns messages for a room, ordered oldest → newest (good for rendering).
//
// PARAMS:
//   roomId (string) — the matchId used as room identifier
//   limit  (number) — how many messages to return (default 50)
//   before (Date)   — cursor for pagination: only return messages before this time
//
// RETURNS: Message[] ordered by sentAt ASC
// ---------------------------------------------------------------------------
const getRoomMessages = async (roomId, limit = 50, before = null) => {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit)));

  const filter = { roomId };
  if (before) {
    filter.sentAt = { $lt: new Date(before) };
  }

  const messages = await Message
    .find(filter)
    .sort({ sentAt: -1 })      // newest first for efficient cursor pagination
    .limit(safeLimit)
    .lean();                    // plain JS objects, faster than Mongoose docs

  // Reverse so the UI receives oldest-first (natural chat order)
  return messages.reverse();
};

module.exports = { saveMessage, getRoomMessages };
