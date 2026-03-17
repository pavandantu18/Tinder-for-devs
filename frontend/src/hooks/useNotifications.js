// =============================================================================
// src/hooks/useNotifications.js
//
// Manages the SSE connection to the Notification Service and exposes:
//   notifications  — array of notification objects
//   unreadCount    — badge number
//   markAllRead()  — clears the badge + marks DB rows as read
//
// HOW SSE WORKS IN THE BROWSER:
//   EventSource opens a persistent GET connection. The server keeps it open
//   and writes "data: <json>\n\n" whenever an event occurs.
//   The browser reconnects automatically if the connection drops.
//
// JWT PASSING:
//   EventSource can't set custom headers, so the JWT is passed as ?token=
//   The notification-service verifies it directly.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

const useNotifications = (isLoggedIn) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const esRef = useRef(null);

  // Open SSE connection when logged in
  useEffect(() => {
    if (!isLoggedIn) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Fetch existing notifications first
    api.get('/notifications?limit=30')
      .then(({ data }) => {
        setNotifications(data.notifications || []);
        setUnreadCount((data.notifications || []).filter((n) => !n.isRead).length);
      })
      .catch(() => {});

    // Open SSE stream — pass JWT as query param
    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        setNotifications((prev) => [notif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch (_) {}
    };

    es.onerror = () => {
      // EventSource reconnects automatically — no action needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [isLoggedIn]);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  return { notifications, unreadCount, markAllRead };
};

export default useNotifications;
