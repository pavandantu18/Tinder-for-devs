// =============================================================================
// src/config/kafka.js — swipe-service
//
// PURPOSE:
//   Kafka PRODUCER for the Swipe Service.
//   Emits swipe.created events after every successful swipe.
//
// TOPIC PRODUCED:
//   swipe.created
//   Payload: { swipeId, swiperId, targetId, direction, createdAt }
//   Who consumes: Match Service — listens for LIKE swipes to detect mutual matches
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'swipe-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 10 },
});

const producer = kafka.producer({ allowAutoTopicCreation: true });

const connectProducer = async () => {
  await producer.connect();
  console.log('[Kafka] Swipe Service producer connected');
};

// ---------------------------------------------------------------------------
// publishSwipeCreated(swipe)
//
// Emits a swipe.created event to Kafka.
// Match Service consumes this to check for mutual matches.
//
// We only strictly need to emit LIKE swipes for match detection,
// but emitting PASS too keeps the event log complete for analytics.
//
// Partition key = swiperId — all swipes by the same user go to the same
// partition, preserving order of that user's swipe history.
// ---------------------------------------------------------------------------
const publishSwipeCreated = async (swipe) => {
  await producer.send({
    topic: 'swipe.created',
    messages: [{
      key: swipe.swiperId,
      value: JSON.stringify(swipe),
    }],
  });
  console.log(`[Kafka] swipe.created published — ${swipe.swiperId} → ${swipe.targetId}: ${swipe.direction}`);
};

const disconnectProducer = async () => {
  await producer.disconnect();
  console.log('[Kafka] Swipe Service producer disconnected');
};

module.exports = { connectProducer, publishSwipeCreated, disconnectProducer };
