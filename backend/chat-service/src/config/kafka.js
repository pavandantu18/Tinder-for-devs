// =============================================================================
// src/config/kafka.js — chat-service
//
// CONSUMER:
//   Topic:  match.created
//   Group:  chat-service-group
//   Action: When a new match is created, cache the matchId as a valid room.
//           This lets us validate room IDs without a gRPC call on every message.
//
// PRODUCER:
//   Topic:  message.sent
//   Payload: { roomId, senderId, recipientId, senderName, sentAt }
//   Who consumes: Notification Service — sends in-app notification to recipient
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'chat-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 10 },
});

// Use a unique group id so fromBeginning always applies — the map must be
// fully rebuilt on every restart (it is in-memory and idempotent).
const consumer = kafka.consumer({ groupId: 'chat-service-room-loader-v2' });
const producer = kafka.producer({ allowAutoTopicCreation: true });

// In-memory store of valid rooms.
// matchId → { user1Id, user2Id }
// Populated by the match.created Kafka consumer on startup (fromBeginning: true).
const roomParticipants = new Map();

const isValidRoom   = (matchId) => roomParticipants.has(matchId);
// Given a roomId and one userId, return the other participant
const getRecipient  = (matchId, senderId) => {
  const room = roomParticipants.get(matchId);
  if (!room) return null;
  return room.user1Id === senderId ? room.user2Id : room.user1Id;
};

// ---------------------------------------------------------------------------
// startConsumer
//
// Subscribes to match.created and adds the matchId to the valid rooms set.
// fromBeginning: true ensures all historical matches are loaded on restart.
// ---------------------------------------------------------------------------
const connectProducer = async () => {
  await producer.connect();
  console.log('[Kafka] Chat Service producer connected');
};

const publishMessageSent = async ({ roomId, senderId, recipientId, sentAt, text, type }) => {
  await producer.send({
    topic: 'message.sent',
    messages: [{
      key: recipientId,
      value: JSON.stringify({ roomId, senderId, recipientId, sentAt, text, type }),
    }],
  });
};

const disconnectProducer = async () => {
  await producer.disconnect();
};

const startConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'match.created', fromBeginning: true });

  await consumer.run({
    autoCommit: false,   // Never commit offsets — fromBeginning rebuilds map on every restart
    eachMessage: async ({ message }) => {
      try {
        const match = JSON.parse(message.value.toString());
        roomParticipants.set(match.matchId, { user1Id: match.user1Id, user2Id: match.user2Id });
        console.log(`[Kafka] Room registered: matchId=${match.matchId}`);
      } catch (err) {
        console.error('[Kafka] Error processing match.created:', err.message);
      }
    },
  });

  console.log('[Kafka] Chat Service consumer started — listening to match.created');
};

const disconnectConsumer = async () => {
  await consumer.disconnect();
  console.log('[Kafka] Chat Service consumer disconnected');
};

module.exports = { connectProducer, disconnectProducer, publishMessageSent, startConsumer, disconnectConsumer, isValidRoom, getRecipient };
