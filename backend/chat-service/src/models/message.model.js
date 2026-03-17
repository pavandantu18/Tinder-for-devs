// =============================================================================
// src/models/message.model.js — chat-service
//
// MongoDB schema for a chat message.
//
// FIELDS:
//   roomId   — the matchId (one chat room per match)
//   senderId — UUID of the user who sent the message (from X-User-Id / JWT)
//   text     — message content
//   sentAt   — when the message was sent (default: now)
//
// INDEX:
//   { roomId, sentAt } — fast retrieval of all messages in a room, newest last
// =============================================================================

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId:   { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    // type determines how the frontend renders the message:
    //   'text'  — plain text (default)
    //   'image' — base64 data URL of an image file
    //   'video' — base64 data URL of a video file
    //   'code'  — monospace code block with preserved whitespace
    type:     { type: String, enum: ['text', 'image', 'video', 'code'], default: 'text' },
    text:     { type: String, required: true, maxlength: 5_000_000 },
    // maxlength is large to accommodate base64-encoded images/videos (~5MB raw = ~6.7MB base64)
    sentAt:   { type: Date, default: Date.now },
  },
  {
    // Don't add Mongoose's default createdAt/updatedAt — we use sentAt
    timestamps: false,
  }
);

// Compound index for efficient room history queries
// "Give me all messages in room X sorted by time"
messageSchema.index({ roomId: 1, sentAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
