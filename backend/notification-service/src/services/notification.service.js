// =============================================================================
// src/services/notification.service.js — notification-service
//
// FUNCTIONS:
//   createNotification(userId, type, title, body, data) — persist + push via SSE
//   getNotifications(userId, limit)                     — fetch history
//   markAllRead(userId)                                 — clear badge
//   getUnreadCount(userId)                              — badge number
//
// SSE (Server-Sent Events):
//   Each connected client registers a Response stream in `sseClients`.
//   When a notification is created, we push it instantly to any open stream
//   for that userId — no polling needed.
//
// WHY SSE OVER WEBSOCKETS FOR NOTIFICATIONS:
//   Notifications are one-directional (server → client only).
//   SSE is simpler: plain HTTP, automatic reconnect, works through proxies.
//   WebSockets add bi-directional complexity we don't need here.
// =============================================================================

const { query } = require('../config/db');

// Map of userId → Set of Express Response objects (active SSE streams)
// Multiple browser tabs = multiple entries for the same userId
const sseClients = new Map();

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

const addClient = (userId, res) => {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
  console.log(`[SSE] Client connected — userId: ${userId} (total: ${sseClients.get(userId).size})`);
};

const removeClient = (userId, res) => {
  sseClients.get(userId)?.delete(res);
  if (sseClients.get(userId)?.size === 0) sseClients.delete(userId);
};

// Push a JSON event to all open SSE streams for a user
const pushToClient = (userId, event) => {
  const clients = sseClients.get(userId);
  if (!clients?.size) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach((res) => {
    try { res.write(data); } catch (_) { /* client disconnected */ }
  });
};

// ---------------------------------------------------------------------------
// createNotification
//
// 1. Insert into DB
// 2. Push to any open SSE stream for the user
// ---------------------------------------------------------------------------
const createNotification = async (userId, type, title, body = '', data = {}) => {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, type, title, body, data, is_read, created_at`,
    [userId, type, title, body, JSON.stringify(data)]
  );

  const notif = result.rows[0];

  // Push to connected SSE streams immediately
  pushToClient(userId.toString(), {
    id:        notif.id,
    type:      notif.type,
    title:     notif.title,
    body:      notif.body,
    data:      notif.data,
    isRead:    notif.is_read,
    createdAt: notif.created_at,
  });

  return notif;
};

// ---------------------------------------------------------------------------
// Kafka event handlers
// ---------------------------------------------------------------------------

// match.created → notify both users
const handleMatchCreated = async ({ matchId, user1Id, user2Id }) => {
  await createNotification(
    user1Id, 'new_match',
    "It's a match!",
    'You and someone both liked each other. Say hello.',
    { matchId, otherUserId: user2Id }
  );
  await createNotification(
    user2Id, 'new_match',
    "It's a match!",
    'You and someone both liked each other. Say hello.',
    { matchId, otherUserId: user1Id }
  );
  console.log(`[Service] Match notifications created for ${user1Id} and ${user2Id}`);
};

// message.sent → notify the recipient (not the sender)
const handleMessageSent = async ({ roomId, senderId, senderName, recipientId, text, type }) => {
  if (!recipientId) return;

  const name  = senderName || 'Your match';
  const body  = text || '';

  await createNotification(
    recipientId, 'new_message',
    `New message from ${name}`,
    body,
    { roomId, senderId }
  );
};

// ---------------------------------------------------------------------------
// REST handlers
// ---------------------------------------------------------------------------

const getNotifications = async (userId, limit = 30) => {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit)));
  const result = await query(
    `SELECT id, type, title, body, data, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );
  return result.rows.map((r) => ({
    id:        r.id,
    type:      r.type,
    title:     r.title,
    body:      r.body,
    data:      r.data,
    isRead:    r.is_read,
    createdAt: r.created_at,
  }));
};

const getUnreadCount = async (userId) => {
  const result = await query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(result.rows[0].count);
};

const markAllRead = async (userId) => {
  await query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
};

module.exports = {
  addClient,
  removeClient,
  handleMatchCreated,
  handleMessageSent,
  getNotifications,
  getUnreadCount,
  markAllRead,
};
