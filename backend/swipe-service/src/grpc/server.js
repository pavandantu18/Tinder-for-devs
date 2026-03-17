// =============================================================================
// src/grpc/server.js — swipe-service
//
// PURPOSE:
//   gRPC server for the Swipe Service.
//   Exposes two RPCs that other services call internally:
//
//   1. CheckMutualLike  — called by Match Service after a LIKE swipe arrives.
//      "Has User B already liked User A?" → yes = mutual match
//
//   2. GetSwipedUserIds — called by User Service when building the /discover feed.
//      "Which profiles has this user already acted on?" → exclude them
//
// PORT: 50053 (internal Docker network only, not exposed to the internet)
// PROTO: ../../proto/swipe.proto (relative to this file: /app/src/grpc → /app/proto)
// =============================================================================

const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const { checkMutualLike, getSwipedUserIds } = require('../services/swipe.service');

// ---------------------------------------------------------------------------
// Load the proto definition
// ---------------------------------------------------------------------------
const PROTO_PATH = path.join(__dirname, '../../proto/swipe.proto');

const packageDef = loader.loadSync(PROTO_PATH, {
  keepCase:     true,
  longs:        String,
  enums:        String,
  defaults:     true,
  oneofs:       true,
});

const swipeProto = grpc.loadPackageDefinition(packageDef).swipe;

// ---------------------------------------------------------------------------
// RPC handler: CheckMutualLike
//
// Called by Match Service when User A swipes LIKE on User B.
// Checks: "Has User B already liked User A?"
//
// Request:  { swiper_id: string, target_id: string }
// Response: { liked: bool }
// ---------------------------------------------------------------------------
const handleCheckMutualLike = async (call, callback) => {
  try {
    const { swiper_id, target_id } = call.request;
    const liked = await checkMutualLike(swiper_id, target_id);
    callback(null, { liked });
  } catch (err) {
    console.error('[gRPC] CheckMutualLike error:', err.message);
    callback({
      code:    grpc.status.INTERNAL,
      message: err.message,
    });
  }
};

// ---------------------------------------------------------------------------
// RPC handler: GetSwipedUserIds
//
// Called by User Service when building the /discover feed.
// Returns all UUIDs that userId has swiped on (LIKE or PASS).
//
// Request:  { user_id: string }
// Response: { swiped_user_ids: string[] }
// ---------------------------------------------------------------------------
const handleGetSwipedUserIds = async (call, callback) => {
  try {
    const { user_id } = call.request;
    const swipedUserIds = await getSwipedUserIds(user_id);
    callback(null, { swiped_user_ids: swipedUserIds });
  } catch (err) {
    console.error('[gRPC] GetSwipedUserIds error:', err.message);
    callback({
      code:    grpc.status.INTERNAL,
      message: err.message,
    });
  }
};

// ---------------------------------------------------------------------------
// startGrpcServer()
//
// Creates and starts the gRPC server on port 50053.
// Binds to 0.0.0.0 so it's reachable from other Docker containers.
// ---------------------------------------------------------------------------
const startGrpcServer = () => {
  const server = new grpc.Server();

  server.addService(swipeProto.SwipeService.service, {
    CheckMutualLike:  handleCheckMutualLike,
    GetSwipedUserIds: handleGetSwipedUserIds,
  });

  const GRPC_PORT = process.env.GRPC_PORT || '50053';

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('[gRPC] Failed to bind:', err.message);
        process.exit(1);
      }
      console.log(`[gRPC] Swipe Service listening on port ${port}`);
    }
  );

  return server;
};

module.exports = { startGrpcServer };
