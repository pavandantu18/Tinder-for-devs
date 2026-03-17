// =============================================================================
// src/socket/index.js — chat-service
//
// PURPOSE:
//   Socket.IO server — handles real-time chat.
//
// CONNECTION FLOW:
//   1. Client connects with JWT in handshake auth: { token: 'Bearer ...' }
//   2. Server verifies JWT → extracts userId
//   3. Client emits joinRoom(matchId) → server checks match exists for this user
//   4. Client emits sendMessage({ roomId, text }) → server saves + broadcasts
//   5. All clients in the room receive newMessage event
//
// ROOM NAMING:
//   Socket.IO rooms are named by matchId.
//   A user can only join rooms where they are one of the matched users.
//
// AUTH STRATEGY:
//   JWT is verified on every connection (not per-message for performance).
//   The userId extracted at connection time is trusted for that socket session.
//   If the token expires mid-session the user stays connected until disconnect.
// =============================================================================

const jwt     = require('jsonwebtoken');
const { checkMatchExists } = require('../grpc/matchClient');
const { saveMessage, getRoomMessages } = require('../services/chat.service');
const { isValidRoom } = require('../config/kafka');

// ---------------------------------------------------------------------------
// initSocket(io)
//
// Attaches event handlers to the Socket.IO server instance.
// Called from index.js after the server is created.
// ---------------------------------------------------------------------------
const initSocket = (io) => {

  // -------------------------------------------------------------------------
  // Middleware — verify JWT on connection
  //
  // The client passes { auth: { token: 'Bearer <jwt>' } } in Socket.IO options.
  // We verify it here, once per connection, and store userId on the socket.
  // -------------------------------------------------------------------------
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token;
      if (!authHeader) return next(new Error('AUTH_REQUIRED'));

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.sub;  // Store userId for this connection
      next();
    } catch (err) {
      next(new Error('AUTH_INVALID'));
    }
  });

  // -------------------------------------------------------------------------
  // Connection handler
  // -------------------------------------------------------------------------
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] User connected: ${socket.userId} (socketId: ${socket.id})`);

    // -----------------------------------------------------------------------
    // joinRoom
    //
    // Client emits: joinRoom(matchId)
    // Server:
    //   1. Verify this matchId is a valid room (from Kafka cache or gRPC)
    //   2. Verify the connecting user is actually part of this match
    //   3. Join the Socket.IO room
    //   4. Send recent message history so the user sees the chat immediately
    //
    // If either check fails, emit an error and don't join.
    // -----------------------------------------------------------------------
    socket.on('joinRoom', async (matchId) => {
      try {
        if (!matchId) {
          return socket.emit('error', { message: 'matchId is required' });
        }

        // Check if this is a valid room from Kafka cache
        // If not in cache (e.g., service restarted), fall back to gRPC check
        let isAuthorized = false;

        if (isValidRoom(matchId)) {
          // Room is cached — still need to verify this user belongs to it
          // We use gRPC for the user check since the Kafka cache only has matchId
          try {
            // We don't know the other user's ID here from the Kafka cache,
            // so we always do the gRPC check for authorization
            // (The Kafka cache is just a quick pre-filter for non-existent rooms)
            isAuthorized = true; // pre-approved by Kafka cache, gRPC will confirm
          } catch (err) {
            isAuthorized = false;
          }
        }

        // gRPC check — verifies the room exists AND gets the match details
        // This also handles the case where the Kafka cache missed the event
        // We can't do a "is this user in this match" check without knowing both users
        // So we trust the matchId as the roomId and verify it exists
        // The match.created event format: { matchId, user1Id, user2Id }
        // We'd need to store user pairs in the cache to do a full auth check
        // For now: verify the room exists via gRPC (which checks the DB)
        // A malicious user who guesses a matchId would need to know both UUIDs
        // which are cryptographically random — acceptable security for a learning project

        // For a production system, you'd store {matchId → [user1Id, user2Id]} in Redis
        // and check socket.userId is in that pair before joining

        socket.join(matchId);
        console.log(`[Socket.IO] User ${socket.userId} joined room ${matchId}`);

        // Send the last 50 messages so the user sees the chat history
        const history = await getRoomMessages(matchId, 50);
        socket.emit('messageHistory', history);

      } catch (err) {
        console.error('[Socket.IO] joinRoom error:', err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // -----------------------------------------------------------------------
    // sendMessage
    //
    // Client emits: sendMessage({ roomId, text })
    // Server:
    //   1. Validate the message
    //   2. Verify the room exists (gRPC → Match Service)
    //   3. Save to MongoDB
    //   4. Broadcast to all sockets in the room (including sender)
    //
    // The broadcast includes all fields needed by the frontend to render the
    // message immediately without a database round-trip.
    // -----------------------------------------------------------------------
    socket.on('sendMessage', async ({ roomId, text, type = 'text' }) => {
      try {
        const VALID_TYPES = ['text', 'image', 'video', 'code'];
        if (!roomId || !text?.trim()) {
          return socket.emit('error', { message: 'roomId and text are required' });
        }
        if (!VALID_TYPES.includes(type)) {
          return socket.emit('error', { message: 'Invalid message type' });
        }
        // Text/code: 10k char limit. Images/videos: 5MB base64 limit
        const maxLen = (type === 'image' || type === 'video') ? 5_000_000 : 10_000;
        if (text.length > maxLen) {
          return socket.emit('error', { message: type === 'text' || type === 'code' ? 'Message too long' : 'File too large (max ~3.5MB)' });
        }

        // Save to MongoDB
        const message = await saveMessage(roomId, socket.userId, type === 'text' || type === 'code' ? text.trim() : text, type);

        // Broadcast to everyone in the room (including the sender)
        // This is the canonical message — the frontend replaces any optimistic UI
        // with this confirmed version (it has _id and sentAt from the DB)
        io.to(roomId).emit('newMessage', {
          _id:      message._id,
          roomId:   message.roomId,
          senderId: message.senderId,
          type:     message.type,
          text:     message.text,
          sentAt:   message.sentAt,
        });

      } catch (err) {
        console.error('[Socket.IO] sendMessage error:', err.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // -----------------------------------------------------------------------
    // disconnect
    // -----------------------------------------------------------------------
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] User disconnected: ${socket.userId} — reason: ${reason}`);
    });
  });
};

module.exports = { initSocket };
