// =============================================================================
// src/grpc/swipeClient.js — user-service
//
// PURPOSE:
//   gRPC CLIENT for the Swipe Service.
//   Used by /discover to filter out profiles the user has already swiped on.
//
// GRPC CALL MADE:
//   GetSwipedUserIds(user_id) → { swiped_user_ids: string[] }
//
// HOW IT WORKS:
//   1. User Service makes a gRPC call to Swipe Service: "give me all IDs
//      that userId has already swiped on"
//   2. User Service excludes those IDs from the /discover SQL query
//   3. Result: the feed only shows unseen profiles
//
// CHANNEL:
//   Connects to swipe-service:50053 on the Docker internal network.
//   Uses insecure credentials (no TLS) — fine for internal service comms.
// =============================================================================

const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../../proto/swipe.proto');

const packageDef = loader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
});

const swipeProto = grpc.loadPackageDefinition(packageDef).swipe;

// Create the gRPC client (channel)
// swipe-service:50053 is the Docker service name + gRPC port
const SWIPE_GRPC_HOST = process.env.SWIPE_GRPC_HOST || 'swipe-service:50053';

const swipeClient = new swipeProto.SwipeService(
  SWIPE_GRPC_HOST,
  grpc.credentials.createInsecure()
);

// ---------------------------------------------------------------------------
// getSwipedUserIds(userId)
//
// Wraps the gRPC callback-style call in a Promise so we can await it.
//
// RETURNS: string[] of user IDs the current user has already swiped on
//
// FALLBACK:
//   If the Swipe Service is unavailable (not yet started, network issue),
//   we return an empty array and log a warning.
//   This means the user might see already-swiped profiles temporarily,
//   but it prevents a complete /discover failure.
// ---------------------------------------------------------------------------
const getSwipedUserIds = (userId) => {
  return new Promise((resolve) => {
    swipeClient.GetSwipedUserIds({ user_id: userId }, (err, response) => {
      if (err) {
        // Non-fatal — log and return empty list so /discover still works
        console.warn('[gRPC Client] GetSwipedUserIds failed (swipe-service may be starting):', err.message);
        return resolve([]);
      }
      resolve(response.swiped_user_ids || []);
    });
  });
};

module.exports = { getSwipedUserIds };
