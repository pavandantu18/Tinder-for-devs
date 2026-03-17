// =============================================================================
// src/hooks/useChatSocket.js
//
// Custom React hook that manages a Socket.IO connection to the Chat Service.
//
// USAGE:
//   const { messages, sendMessage, connected } = useChatSocket(matchId);
//
// WHAT IT DOES:
//   1. Connects to Socket.IO at the API Gateway (which proxies to chat-service)
//   2. Sends the JWT in the handshake auth header for server-side verification
//   3. Emits joinRoom(matchId) once connected
//   4. Receives messageHistory[] on join — populates initial chat
//   5. Receives newMessage on every sent message — appends to the list
//   6. Disconnects when the component unmounts (matchId changes or page leaves)
//
// WHY A CUSTOM HOOK:
//   Encapsulates all socket lifecycle logic (connect, join, listen, disconnect)
//   so ChatPage stays clean and focused on rendering.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useChatSocket = (matchId) => {
  const [messages, setMessages]   = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!matchId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Connect to Socket.IO via the API Gateway
    // The gateway proxies /socket.io/* → chat-service:3005
    // We connect to the same origin so the Vite proxy handles /socket.io/* too
    const socket = io('/', {
      path: '/socket.io',
      auth: { token: `Bearer ${token}` },
      // transports: ['websocket'] — optionally force WebSocket only (skip polling)
    });

    socketRef.current = socket;

    // -----------------------------------------------------------------------
    // Socket events
    // -----------------------------------------------------------------------

    socket.on('connect', () => {
      setConnected(true);
      setError('');
      // Join the chat room for this match
      socket.emit('joinRoom', matchId);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(`Connection failed: ${err.message}`);
      setConnected(false);
    });

    // Receive full history when joining a room
    socket.on('messageHistory', (history) => {
      setMessages(history);
    });

    // Receive new messages in real time
    socket.on('newMessage', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    // Cleanup: disconnect when component unmounts or matchId changes
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setMessages([]);
      setConnected(false);
    };
  }, [matchId]);

  // ---------------------------------------------------------------------------
  // sendMessage(text)
  //
  // Emits the sendMessage event to the server.
  // The server saves it, then broadcasts newMessage back to all room members
  // (including this socket), which triggers the newMessage handler above.
  // ---------------------------------------------------------------------------
  // type: 'text' | 'image' | 'video' | 'code'
  const sendMessage = (text, type = 'text') => {
    if (!socketRef.current?.connected || !text) return;
    const payload = type === 'text' || type === 'code'
      ? { roomId: matchId, text: text.trim(), type }
      : { roomId: matchId, text, type }; // images/videos: don't trim the data URL
    socketRef.current.emit('sendMessage', payload);
  };

  return { messages, sendMessage, connected, error };
};

export default useChatSocket;
