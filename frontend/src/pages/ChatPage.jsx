// =============================================================================
// src/pages/ChatPage.jsx
//
// Rich real-time chat with:
//   - Matched user's name + photo in header
//   - Text messages with emoji picker
//   - Photo / video file uploads (sent as base64 data URLs)
//   - Code snippet mode (monospace, preserved whitespace)
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';
import { useAuth } from '../context/AuthContext';
import useChatSocket from '../hooks/useChatSocket';
import { getMatch } from '../api/match';
import { ChevronLeftIcon, EmojiIcon, AttachIcon, CodeIcon, SendIcon } from '../components/Icons';
import '../styles/chat.css';

// Max raw file size before base64 encoding (~3.5 MB → ~4.7 MB base64)
const MAX_FILE_BYTES = 3.5 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble — renders one message based on its type
// ─────────────────────────────────────────────────────────────────────────────
const MessageBubble = ({ msg, isOwn }) => {
  const time = new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let content;
  if (msg.type === 'image') {
    content = (
      <img
        src={msg.text}
        alt="sent image"
        className="msg-image"
        onClick={() => window.open(msg.text, '_blank')}
      />
    );
  } else if (msg.type === 'video') {
    content = (
      <video src={msg.text} controls className="msg-video" />
    );
  } else if (msg.type === 'code') {
    content = (
      <pre className="msg-code"><code>{msg.text}</code></pre>
    );
  } else {
    // Plain text — preserve line breaks
    content = <p className="message-text">{msg.text}</p>;
  }

  return (
    <div className={`message-bubble ${isOwn ? 'own' : 'theirs'}`}>
      {content}
      <span className="message-time">{time}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ChatPage
// ─────────────────────────────────────────────────────────────────────────────
const ChatPage = () => {
  const { matchId }   = useParams();
  const { state }     = useLocation();
  const { user }      = useAuth();
  const navigate      = useNavigate();

  // matchedUser comes from router state (Matches page) or is fetched below
  const [matchedUser, setMatchedUser] = useState(state?.matchedUser || null);

  useEffect(() => {
    if (!matchedUser && matchId) {
      getMatch(matchId).then((m) => { if (m) setMatchedUser(m.user); }).catch(() => {});
    }
  }, [matchId]);

  const [text, setText]             = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [showEmoji, setShowEmoji]   = useState(false);
  const [fileError, setFileError]   = useState('');
  const bottomRef   = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);

  const { messages, sendMessage, connected, error } = useChatSocket(matchId);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (!e.target.closest('.emoji-wrapper')) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  // ── Send text / code ─────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    sendMessage(text, isCodeMode ? 'code' : 'text');
    setText('');
    setIsCodeMode(false);
  }, [text, isCodeMode, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isCodeMode) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Emoji picker ─────────────────────────────────────────────────────────
  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
    textareaRef.current?.focus();
  };

  // ── File upload (photo / video) ───────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    e.target.value = '';   // reset so same file can be re-selected

    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File too large. Max size is 3.5 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      setFileError('Only image and video files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      sendMessage(reader.result, isVideo ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="chat-page">

      {/* ── Header ── */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={() => navigate('/matches')}><ChevronLeftIcon size={24}/></button>

        <div className="chat-peer">
          <div className="chat-peer-avatar">
            {matchedUser?.photo_url
              ? <img src={matchedUser.photo_url} alt={matchedUser.name} />
              : <span>{matchedUser?.name?.[0]?.toUpperCase() || '?'}</span>
            }
          </div>
          <div className="chat-peer-info">
            <span className="chat-peer-name">{matchedUser?.name || 'Your Match'}</span>
            <span className={`connection-status ${connected ? 'online' : 'offline'}`}>
              {connected ? '● live' : '○ connecting...'}
            </span>
          </div>
        </div>
      </div>

      {error    && <div className="chat-error">{error}</div>}
      {fileError && <div className="chat-error">{fileError}</div>}

      {/* ── Messages ── */}
      <div className="messages-list">
        {messages.length === 0 && connected && (
          <div className="chat-empty">
            <p>No messages yet — say hello! 👋</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.sub || msg.senderId === user?.userId;
          return <MessageBubble key={msg._id} msg={msg} isOwn={isOwn} />;
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Code mode banner ── */}
      {isCodeMode && (
        <div className="code-mode-banner">
          <span>📝 Code snippet mode — Shift+Enter for new lines, Enter to send</span>
          <button onClick={() => setIsCodeMode(false)}>✕</button>
        </div>
      )}

      {/* ── Emoji picker (floats above toolbar) ── */}
      {showEmoji && (
        <div className="emoji-wrapper">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="dark"
            height={380}
            width={320}
            searchDisabled={false}
            skinTonesDisabled
          />
        </div>
      )}

      {/* ── Input bar — all controls in one row ── */}
      <div className="chat-input-bar">

        {/* Emoji */}
        <button
          className={`tool-btn ${showEmoji ? 'active' : ''}`}
          onClick={() => setShowEmoji((v) => !v)}
          title="Emoji"
        ><EmojiIcon size={20}/></button>

        {/* Photo / Video */}
        <button
          className="tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Send photo or video"
        ><AttachIcon size={20}/></button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Code snippet */}
        <button
          className={`tool-btn ${isCodeMode ? 'active' : ''}`}
          onClick={() => setIsCodeMode((v) => !v)}
          title="Code snippet"
        ><CodeIcon size={20}/></button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          className={`chat-input ${isCodeMode ? 'code-input' : ''}`}
          placeholder={
            !connected ? 'Connecting...' :
            isCodeMode ? 'Paste your code here...' :
                         'Message...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected}
          rows={isCodeMode ? 4 : 1}
        />

        {/* Send */}
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!connected || !text.trim()}
        ><SendIcon size={18}/></button>

      </div>

    </div>
  );
};

export default ChatPage;
