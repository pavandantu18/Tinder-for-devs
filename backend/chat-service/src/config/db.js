// =============================================================================
// src/config/db.js — chat-service
//
// PURPOSE:
//   Connects to MongoDB using Mongoose.
//   MongoDB is chosen for chat messages because:
//   1. Documents map naturally to messages (no schema migrations needed)
//   2. Write-heavy workloads — Mongo handles high-volume inserts well
//   3. Query pattern is simple: find by roomId, sort by sentAt
//
// COLLECTIONS (defined via Mongoose models):
//   messages — { roomId, senderId, text, sentAt }
// =============================================================================

const mongoose = require('mongoose');

const connectMongo = async () => {
  const uri = process.env.MONGO_URI
    || `mongodb://${process.env.MONGO_CHAT_USER}:${process.env.MONGO_CHAT_PASSWORD}@mongo-chat:27017/chat_db?authSource=admin`;

  await mongoose.connect(uri);
  console.log('[DB] Connected to MongoDB (chat_db)');
};

const disconnectMongo = async () => {
  await mongoose.disconnect();
  console.log('[DB] MongoDB disconnected');
};

module.exports = { connectMongo, disconnectMongo };
