// =============================================================================
// src/components/NotificationBell.jsx
//
// Bell icon with unread badge. Clicking opens a dropdown panel showing
// recent notifications. Clicking the panel marks all as read.
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications';
import '../styles/notifications.css';

const NotificationBell = ({ isLoggedIn }) => {
  const navigate                          = useNavigate();
  const [open, setOpen]                   = useState(false);
  const panelRef                          = useRef(null);
  const { notifications, unreadCount, markAllRead } = useNotifications(isLoggedIn);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  const handleNotifClick = (notif) => {
    setOpen(false);
    if (notif.type === 'new_match' && notif.data?.matchId) {
      navigate(`/chat/${notif.data.matchId}`);
    } else if (notif.type === 'new_message' && notif.data?.roomId) {
      navigate(`/chat/${notif.data.roomId}`);
    }
  };

  return (
    <div className="notif-bell-wrapper" ref={panelRef}>
      <button className="notif-bell-btn" onClick={handleOpen} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notifications</span>
            {unreadCount === 0 && notifications.length > 0 && (
              <span className="notif-all-read">All caught up ✓</span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            <ul className="notif-list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`notif-item ${!n.isRead ? 'unread' : ''} ${n.type === 'new_match' || n.type === 'new_message' ? 'clickable' : ''}`}
                  onClick={() => handleNotifClick(n)}
                >
                  <span className="notif-icon">
                    {n.type === 'new_match'   ? '❤️' : '💬'}
                  </span>
                  <div className="notif-content">
                    <p className="notif-title">{n.title}</p>
                    {n.body && <p className="notif-body">{n.body}</p>}
                    <p className="notif-time">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.isRead && <span className="notif-dot" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
