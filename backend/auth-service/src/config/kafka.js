// =============================================================================
// src/config/kafka.js
// Service: auth-service
//
// PURPOSE:
//   Sets up the Kafka producer for the Auth Service.
//   The Auth Service only PRODUCES events — it never consumes.
//
// EVENTS PRODUCED BY AUTH SERVICE:
//   Topic: user.created
//   When:  A new user successfully registers
//   Payload: { userId, email, createdAt }
//   Who listens: User Service (creates a blank profile for the new user)
//
// HOW KAFKA WORKS (quick recap):
//   - A Kafka "topic" is like a named log / queue
//   - A "producer" writes messages (events) to a topic
//   - A "consumer" reads messages from a topic
//   - Messages stay in the topic for a retention period (7 days in our config)
//     so consumers can catch up if they were offline
//
// KAFKAJS CONCEPTS:
//   Kafka (client)    → knows how to talk to the Kafka broker
//   Producer          → connection from the client that can write messages
//   producer.connect() → opens the connection to the broker
//   producer.send()   → writes one or more messages to a topic
//   producer.disconnect() → cleanly closes the connection
// =============================================================================

const { Kafka, logLevel } = require('kafkajs');

// Create the KafkaJS client — this is the base connection config.
// One client can spawn multiple producers and consumers.
const kafka = new Kafka({
  clientId: 'auth-service',
    // A human-readable name for this client, shown in Kafka logs.
    // Helps identify which service is producing messages when debugging.

  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
    // Array of broker addresses. We have one broker.
    // 'kafka:9092' resolves via Docker DNS to the kafka container.
    // KafkaJS tries these addresses to find a reachable broker.

  logLevel: logLevel.WARN,
    // KafkaJS log verbosity. Options: NOTHING, ERROR, WARN, INFO, DEBUG.
    // WARN keeps logs clean in development — only shows problems.
    // Change to INFO if you want to see every message being produced.

  retry: {
    initialRetryTime: 300,
      // Wait 300ms before the first retry after a failure.
    retries: 10,
      // Try up to 10 times before giving up.
      // Important during startup — Kafka may not be ready when the service starts.
  },
});

// Create a producer from the client.
// A producer is the actual connection that sends messages.
const producer = kafka.admin();
// ^ This should be kafka.producer() — fixed below:
const kafkaProducer = kafka.producer({
  allowAutoTopicCreation: true,
    // If the topic doesn't exist when we try to produce, create it automatically.
    // Matches KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true" in docker-compose.yml.
});

// ---------------------------------------------------------------------------
// connectProducer()
//
// Opens the connection from this service to the Kafka broker.
// Must be called once during service startup before producing any events.
// KafkaJS uses TCP connections — connect() establishes that connection.
//
// Retries automatically (per the retry config above), so if Kafka isn't
// ready when the service starts, it will keep trying until it connects.
// ---------------------------------------------------------------------------
const connectProducer = async () => {
  try {
    await kafkaProducer.connect();
    console.log('[Kafka] Producer connected to broker:', process.env.KAFKA_BROKER || 'kafka:9092');
  } catch (err) {
    console.error('[Kafka] Failed to connect producer:', err.message);
    throw err; // Re-throw so startup fails loudly if Kafka is unreachable
  }
};

// ---------------------------------------------------------------------------
// publishEvent(topic, message)
//
// Publishes a single event to a Kafka topic.
//
// PARAMS:
//   topic   (string) — The Kafka topic name (e.g., 'user.created')
//   message (object) — The event payload (will be JSON-serialized)
//
// HOW KAFKA MESSAGES WORK:
//   Each message has:
//     key   (optional) — Used by Kafka to route to a partition.
//                        We use userId as the key so all events for the same
//                        user go to the same partition (ordering guarantee).
//     value (required) — The actual message content as a string or Buffer.
//                        We JSON.stringify() our objects.
//
// EXAMPLE:
//   await publishEvent('user.created', { userId: '123', email: 'a@b.com' });
// ---------------------------------------------------------------------------
const publishEvent = async (topic, message) => {
  try {
    await kafkaProducer.send({
      topic,
      messages: [
        {
          // Use userId as partition key (ensures ordering per user)
          key: message.userId ? String(message.userId) : null,
          // Serialize the event payload to JSON string
          value: JSON.stringify(message),
        },
      ],
    });
    console.log(`[Kafka] Event published → topic: "${topic}", payload:`, message);
  } catch (err) {
    console.error(`[Kafka] Failed to publish to topic "${topic}":`, err.message);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// disconnectProducer()
//
// Gracefully closes the producer connection.
// Called during server shutdown (SIGTERM/SIGINT) to flush pending messages
// before the process exits. Without this, in-flight messages may be lost.
// ---------------------------------------------------------------------------
const disconnectProducer = async () => {
  try {
    await kafkaProducer.disconnect();
    console.log('[Kafka] Producer disconnected');
  } catch (err) {
    console.error('[Kafka] Error disconnecting producer:', err.message);
  }
};

module.exports = { connectProducer, publishEvent, disconnectProducer };
