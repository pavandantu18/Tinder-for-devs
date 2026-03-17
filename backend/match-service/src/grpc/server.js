// =============================================================================
// src/grpc/server.js — match-service
//
// PURPOSE:
//   gRPC SERVER for the Match Service.
//   Exposes CheckMatchExists so Chat Service can verify a match before
//   allowing users to send messages.
//
// PORT: 50054 (internal Docker network only)
// =============================================================================

const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const { checkMatchExists } = require('../services/match.service');

const PROTO_PATH = path.join(__dirname, '../../proto/match.proto');

const packageDef = loader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
});

const matchProto = grpc.loadPackageDefinition(packageDef).match;

// ---------------------------------------------------------------------------
// RPC handler: CheckMatchExists
//
// Called by Chat Service before allowing a message.
// "Do user1 and user2 have a confirmed match?"
//
// Request:  { user1_id, user2_id }
// Response: { exists: bool, match_id: string }
// ---------------------------------------------------------------------------
const handleCheckMatchExists = async (call, callback) => {
  try {
    const { user1_id, user2_id } = call.request;
    const result = await checkMatchExists(user1_id, user2_id);
    callback(null, {
      exists:   result !== null,
      match_id: result?.id || '',
    });
  } catch (err) {
    console.error('[gRPC] CheckMatchExists error:', err.message);
    callback({
      code:    grpc.status.INTERNAL,
      message: err.message,
    });
  }
};

// ---------------------------------------------------------------------------
// startGrpcServer
// ---------------------------------------------------------------------------
const startGrpcServer = () => {
  const server = new grpc.Server();

  server.addService(matchProto.MatchService.service, {
    CheckMatchExists: handleCheckMatchExists,
  });

  const GRPC_PORT = process.env.GRPC_MATCH_PORT || '50054';

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('[gRPC] Failed to bind:', err.message);
        process.exit(1);
      }
      console.log(`[gRPC] Match Service listening on port ${port}`);
    }
  );

  return server;
};

module.exports = { startGrpcServer };
