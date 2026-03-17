// =============================================================================
// src/grpc/matchClient.js — chat-service
//
// PURPOSE:
//   gRPC CLIENT for the Match Service.
//   Called on socket connection and message send to verify the two users
//   have a confirmed match before allowing chat.
//
// RPC CALLED:
//   CheckMatchExists(user1_id, user2_id) → { exists: bool, match_id: string }
// =============================================================================

const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../../proto/match.proto');

const packageDef = loader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
});

const matchProto = grpc.loadPackageDefinition(packageDef).match;

const MATCH_GRPC_HOST = process.env.MATCH_GRPC_HOST || 'match-service:50054';

const matchClient = new matchProto.MatchService(
  MATCH_GRPC_HOST,
  grpc.credentials.createInsecure()
);

// ---------------------------------------------------------------------------
// checkMatchExists(userId1, userId2)
//
// Returns { exists, matchId } — both fields needed by callers.
// ---------------------------------------------------------------------------
const checkMatchExists = (userId1, userId2) => {
  return new Promise((resolve, reject) => {
    matchClient.CheckMatchExists(
      { user1_id: userId1, user2_id: userId2 },
      (err, response) => {
        if (err) return reject(err);
        resolve({ exists: response.exists, matchId: response.match_id });
      }
    );
  });
};

module.exports = { checkMatchExists };
