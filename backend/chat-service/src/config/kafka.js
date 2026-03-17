// =============================================================================
// src/config/kafka.js — chat-service
//
// CONSUMER:
//   Topic:  match.created
//   Group:  chat-service-group
//   Action: When a new match is created, cache the matchId as a valid room.
//           This lets us validate room IDs without a gRPC call on every message.
//
// NOTE: Chat Service does NOT produce to Kafka in this step.
//       In Step 8, it would emit message.sent → Notification Service.
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'chat-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 10 },
});

const consumer = kafka.consumer({ groupId: 'chat-service-group' });

// In-memory set of valid match IDs (rooms).
// Populated by the match.created Kafka consumer.
// On restart, fromBeginning: true replays all events to rebuild this set.
const validMatchIds = new Set();

const isValidRoom = (matchId) => validMatchIds.has(matchId);

// ---------------------------------------------------------------------------
// startConsumer
//
// Subscribes to match.created and adds the matchId to the valid rooms set.
// fromBeginning: true ensures all historical matches are loaded on restart.
// ---------------------------------------------------------------------------
const startConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'match.created', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const match = JSON.parse(message.value.toString());
        validMatchIds.add(match.matchId);
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

module.exports = { startConsumer, disconnectConsumer, isValidRoom };
