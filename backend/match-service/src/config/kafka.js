// =============================================================================
// src/config/kafka.js — match-service
//
// CONSUMER:
//   Topic:    swipe.created
//   Group:    match-service-group
//   Action:   For every LIKE swipe, call CheckMutualLike on Swipe Service.
//             If mutual → create match → emit match.created
//
// PRODUCER:
//   Topic:    match.created
//   Payload:  { matchId, user1Id, user2Id, createdAt }
//   Who consumes:
//     - Chat Service (Step 7)        — creates a chat room
//     - Notification Service (Step 8) — sends push notification
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'match-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 10 },
});

const consumer = kafka.consumer({ groupId: 'match-service-group' });
const producer = kafka.producer({ allowAutoTopicCreation: true });

// ---------------------------------------------------------------------------
// connectProducer / disconnectProducer
// ---------------------------------------------------------------------------
const connectProducer = async () => {
  await producer.connect();
  console.log('[Kafka] Match Service producer connected');
};

const disconnectProducer = async () => {
  await producer.disconnect();
  console.log('[Kafka] Match Service producer disconnected');
};

// ---------------------------------------------------------------------------
// publishMatchCreated(match)
//
// Emits match.created after a mutual like is confirmed.
// Chat Service and Notification Service listen to this topic.
//
// Partition key = matchId — one partition per match keeps ordering simple.
// ---------------------------------------------------------------------------
const publishMatchCreated = async (match) => {
  await producer.send({
    topic: 'match.created',
    messages: [{
      key:   match.matchId,
      value: JSON.stringify(match),
    }],
  });
  console.log(`[Kafka] match.created published — matchId: ${match.matchId} (${match.user1Id} ↔ ${match.user2Id})`);
};

// ---------------------------------------------------------------------------
// startConsumer(onSwipeCreated)
//
// Subscribes to swipe.created and calls the handler for every message.
//
// IMPORTANT — fromBeginning: true
//   If Match Service restarts, it replays all historical swipe.created events.
//   This is safe because createMatch uses ON CONFLICT DO NOTHING.
//   Without this, swipes that arrived while match-service was down would be
//   permanently missed, causing mutual likes to go undetected.
// ---------------------------------------------------------------------------
const startConsumer = async (onSwipeCreated) => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'swipe.created', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const swipe = JSON.parse(message.value.toString());
        await onSwipeCreated(swipe);
      } catch (err) {
        console.error('[Kafka] Error processing swipe.created:', err.message);
        // Don't throw — KafkaJS will retry on crash, but a bad message
        // would loop forever. Log and move on.
      }
    },
  });

  console.log('[Kafka] Match Service consumer started — listening to swipe.created');
};

const disconnectConsumer = async () => {
  await consumer.disconnect();
  console.log('[Kafka] Match Service consumer disconnected');
};

module.exports = {
  connectProducer,
  disconnectProducer,
  publishMatchCreated,
  startConsumer,
  disconnectConsumer,
};
