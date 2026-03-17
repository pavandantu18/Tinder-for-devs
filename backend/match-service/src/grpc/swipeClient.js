// =============================================================================
// src/grpc/swipeClient.js — match-service
//
// PURPOSE:
//   gRPC CLIENT for the Swipe Service.
//   Called when a LIKE swipe arrives on Kafka: "Has the target already liked
//   the swiper back?" → yes = mutual match.
//
// RPC CALLED:
//   CheckMutualLike(swiper_id, target_id) → { liked: bool }
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

const SWIPE_GRPC_HOST = process.env.SWIPE_GRPC_HOST || 'swipe-service:50053';

const swipeClient = new swipeProto.SwipeService(
  SWIPE_GRPC_HOST,
  grpc.credentials.createInsecure()
);

// ---------------------------------------------------------------------------
// checkMutualLike(swiperId, targetId)
//
// Asks Swipe Service: "Has targetId already liked swiperId?"
// If yes → mutual match → Match Service creates the match.
//
// RETURNS: boolean
// THROWS:  on gRPC error (caller should handle)
// ---------------------------------------------------------------------------
const checkMutualLike = (swiperId, targetId) => {
  return new Promise((resolve, reject) => {
    swipeClient.CheckMutualLike(
      { swiper_id: swiperId, target_id: targetId },
      (err, response) => {
        if (err) return reject(err);
        resolve(response.liked);
      }
    );
  });
};

module.exports = { checkMutualLike };
