// =============================================================================
// src/controllers/notification.controller.js — notification-service
//
// HANDLERS:
//   sseStream    — GET /api/notifications/stream — open SSE connection
//   getAll       — GET /api/notifications        — fetch history
//   getCount     — GET /api/notifications/count  — unread badge count
//   markRead     — PUT /api/notifications/read   — mark all as read
//   healthCheck  — GET /health
// =============================================================================

const {
  addClient,
  removeClient,
  getNotifications,
  getUnreadCount,
  markAllRead,
} = require('../services/notification.service');

// ---------------------------------------------------------------------------
// sseStream
//
// Opens a persistent HTTP connection using Server-Sent Events protocol.
//
// HOW SSE WORKS:
//   1. Client sends a normal GET request
//   2. Server responds with Content-Type: text/event-stream and keeps it open
//   3. Server writes "data: <json>\n\n" whenever a new event occurs
//   4. Browser's EventSource API auto-reconnects if the connection drops
//
// The client never needs to poll — events arrive instantly.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

const sseStream = (req, res) => {
  // SSE: EventSource can't set headers, so JWT comes as ?token=<jwt>
  // OR the gateway injects X-User-Id when it can (non-SSE paths)
  let userId = req.headers['x-user-id'];

  if (!userId && req.query.token) {
    try {
      const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
      userId = decoded.sub;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // SSE headers — tell the browser this is a long-lived event stream
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
  res.flushHeaders();

  // Send an initial comment to confirm the connection
  res.write(': connected\n\n');

  // Register this response as an active SSE stream for this user
  addClient(userId, res);

  // Heartbeat every 25 seconds to prevent proxy/load-balancer timeouts
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 25_000);

  // Clean up when the client disconnects (tab closed, navigation away)
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
    console.log(`[SSE] Client disconnected — userId: ${userId}`);
  });
};

// ---------------------------------------------------------------------------
// getAll — fetch notification history
// ---------------------------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = req.query.limit || 30;
    const notifications = await getNotifications(userId, limit);
    return res.status(200).json({ notifications });
  } catch (err) {
    console.error('[Controller] getAll error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// getCount — unread badge count
// ---------------------------------------------------------------------------
const getCount = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const count = await getUnreadCount(userId);
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// markRead — mark all notifications as read (clears badge)
// ---------------------------------------------------------------------------
const markRead = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await markAllRead(userId);
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const healthCheck = (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
};

module.exports = { sseStream, getAll, getCount, markRead, healthCheck };
