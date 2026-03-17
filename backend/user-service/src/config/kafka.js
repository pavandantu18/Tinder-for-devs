// =============================================================================
// src/config/kafka.js
// Service: user-service
//
// PURPOSE:
//   Sets up the Kafka CONSUMER for the User Service.
//   Unlike Auth Service (which only produces), User Service only CONSUMES.
//
// TOPIC CONSUMED:
//   user.created
//   Produced by: Auth Service after a successful registration
//   Payload:     { userId, email, createdAt }
//   Action:      Create a blank profile row in user_db for the new user
//
// WHY A CONSUMER GROUP:
//   Consumer groups let Kafka track which messages have been processed.
//   If the User Service restarts, it resumes from where it left off —
//   it won't reprocess already-handled events, and won't miss any events
//   that arrived while it was down. Kafka holds the messages until consumed.
//
//   Group ID 'user-service-group' means all instances of user-service
//   share the workload. If we run 3 instances, Kafka splits partitions
//   across them so each message is processed by exactly one instance.
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 10 },
});

const consumer = kafka.consumer({
  groupId: 'user-service-group',
    // Unique group ID for this service.
    // All user-service instances share this group — Kafka distributes messages.
});

// ---------------------------------------------------------------------------
// startConsumer(onUserCreated)
//
// Connects the consumer, subscribes to user.created, and starts the
// message processing loop.
//
// PARAMS:
//   onUserCreated (async function) — called for each user.created message
//     Receives: { userId, email, createdAt }
//
// fromBeginning: false
//   Only process messages published AFTER this consumer first connects.
//   If you want to replay all historical events (e.g., to rebuild the DB),
//   set this to true. For normal operation, false is correct.
// ---------------------------------------------------------------------------
const startConsumer = async (onUserCreated) => {
  await consumer.connect();
  console.log('[Kafka] Consumer connected');

  await consumer.subscribe({
    topic: 'user.created',
    fromBeginning: true,
    // true = replay all historical events from the beginning of the topic.
    // Safe because createBlankProfile uses ON CONFLICT DO NOTHING — replaying
    // the same user.created event multiple times is harmless.
    // This ensures no registrations are missed if user-service was down
    // when the event was published.
  });

  // consumer.run() starts a long-running loop that:
  //   1. Fetches messages from Kafka in batches
  //   2. Calls our eachMessage handler for each message
  //   3. Commits the offset after successful processing
  //      (so a restart doesn't reprocess the same message)
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        // Kafka message values are Buffers — parse to string then JSON
        const payload = JSON.parse(message.value.toString());
        console.log(`[Kafka] Received user.created event:`, payload);

        await onUserCreated(payload);
      } catch (err) {
        // Log but don't throw — throwing here would crash the consumer loop.
        // In production, failed messages should go to a Dead Letter Queue (DLQ).
        console.error('[Kafka] Failed to process user.created event:', err.message);
      }
    },
  });

  console.log('[Kafka] Listening on topic: user.created');
};

// ---------------------------------------------------------------------------
// disconnectConsumer()
// Called during graceful shutdown to cleanly close the Kafka connection.
// ---------------------------------------------------------------------------
const disconnectConsumer = async () => {
  await consumer.disconnect();
  console.log('[Kafka] Consumer disconnected');
};

module.exports = { startConsumer, disconnectConsumer };
