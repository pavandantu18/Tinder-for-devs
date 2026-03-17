// =============================================================================
// src/config/kafka.js — notification-service
//
// CONSUMERS:
//   match.created  → notify both users "You have a new match! 🎉"
//   message.sent   → notify the recipient "New message from <sender>"
//
// No producer — notification-service only reads events, it doesn't emit any.
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 10 },
});

const consumer = kafka.consumer({ groupId: 'notification-service-group' });

// ---------------------------------------------------------------------------
// startConsumer(handlers)
//
// handlers.onMatchCreated(event)   — called for each match.created message
// handlers.onMessageSent(event)    — called for each message.sent message
//
// fromBeginning: true — replay all events on restart so no notification
// is ever permanently missed (createNotification is idempotent via the
// unique source_event_id constraint).
// ---------------------------------------------------------------------------
const startConsumer = async ({ onMatchCreated, onMessageSent }) => {
  await consumer.connect();

  await consumer.subscribe({ topic: 'match.created',  fromBeginning: true });
  await consumer.subscribe({ topic: 'message.sent',   fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());

        if (topic === 'match.created')  await onMatchCreated(payload);
        if (topic === 'message.sent')   await onMessageSent(payload);
      } catch (err) {
        console.error(`[Kafka] Error processing ${topic}:`, err.message);
      }
    },
  });

  console.log('[Kafka] Notification Service consumer started');
};

const disconnectConsumer = async () => {
  await consumer.disconnect();
  console.log('[Kafka] Notification Service consumer disconnected');
};

module.exports = { startConsumer, disconnectConsumer };
