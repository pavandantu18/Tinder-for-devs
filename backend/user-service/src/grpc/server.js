// =============================================================================
// src/grpc/server.js
// Service: user-service
//
// PURPOSE:
//   gRPC server that exposes the UserService defined in proto/user.proto.
//   Called by Match Service (Step 6) to fetch profile data when a match occurs.
//
// WHY gRPC HERE (not REST):
//   Match Service needs profile data synchronously — it must have both users'
//   names/photos before it can emit match.created. A direct gRPC call is
//   faster and more type-safe than an HTTP call. The proto file defines
//   the exact shape of the data, catching errors at development time.
//
// HOW @grpc/proto-loader WORKS:
//   Instead of generating code from the .proto file (like protoc does),
//   proto-loader loads and parses the .proto file at runtime.
//   This keeps things simple — no build step, no generated files.
//
// PORT: 50052
//   Separate from the HTTP port (3002). gRPC runs on its own port.
//   HTTP for client-facing APIs, gRPC for internal service-to-service calls.
// =============================================================================

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { getProfileById } = require('../services/user.service');

// Path to the proto file.
// Dockerfile copies proto/ into /app/proto/ (see backend/user-service/Dockerfile).
// __dirname = /app/src/grpc → ../../proto/user.proto = /app/proto/user.proto
const PROTO_PATH = path.join(__dirname, '../../proto/user.proto');

// Load the proto definition
// keepCase: true — keeps field names as-is (don't convert to camelCase)
// longs: String — represent int64 as strings (avoids JS number precision issues)
// enums: String — represent enums as their string names
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// Load the package — gives us access to the service and message types
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

// ---------------------------------------------------------------------------
// RPC IMPLEMENTATIONS
// Each function implements one RPC method defined in user.proto.
// Signature: (call, callback) where:
//   call.request — the incoming request message
//   callback(error, response) — send back the response or an error
// ---------------------------------------------------------------------------

// GetUserProfile — fetch one profile by userId
const getUserProfile = async (call, callback) => {
  try {
    const { user_id } = call.request;
    const profile = await getProfileById(user_id);

    if (!profile) {
      // gRPC error codes: NOT_FOUND = 5
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Profile not found for userId: ${user_id}`,
      });
    }

    // Return the response shaped to match UserProfile message in proto
    callback(null, {
      id:         profile.id,
      name:       profile.name       || '',
      bio:        profile.bio        || '',
      skills:     profile.skills     || [],
      github_url: profile.github_url || '',
      photo_url:  profile.photo_url  || '',
    });
  } catch (err) {
    console.error('[gRPC] getUserProfile error:', err.message);
    callback({ code: grpc.status.INTERNAL, message: 'Internal server error' });
  }
};

// GetMultipleProfiles — batch fetch profiles by a list of userIds
const getMultipleProfiles = async (call, callback) => {
  try {
    const { user_ids } = call.request;

    // Fetch all profiles concurrently using Promise.all
    const profiles = await Promise.all(
      user_ids.map((id) => getProfileById(id))
    );

    // Filter out nulls (profiles not found) and shape to proto message
    const validProfiles = profiles
      .filter(Boolean)
      .map((p) => ({
        id:         p.id,
        name:       p.name       || '',
        bio:        p.bio        || '',
        skills:     p.skills     || [],
        github_url: p.github_url || '',
        photo_url:  p.photo_url  || '',
      }));

    callback(null, { profiles: validProfiles });
  } catch (err) {
    console.error('[gRPC] getMultipleProfiles error:', err.message);
    callback({ code: grpc.status.INTERNAL, message: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// startGrpcServer()
//
// Creates and starts the gRPC server.
// Called once from index.js during startup.
//
// RETURNS: the server instance (used for graceful shutdown)
// ---------------------------------------------------------------------------
const startGrpcServer = () => {
  const server = new grpc.Server();

  // Register the UserService implementation
  server.addService(userProto.UserService.service, {
    GetUserProfile:     getUserProfile,
    GetMultipleProfiles: getMultipleProfiles,
  });

  const GRPC_PORT = process.env.GRPC_USER_SERVICE_PORT || '50052';
  const address = `0.0.0.0:${GRPC_PORT}`;

  // grpc.ServerCredentials.createInsecure() — no TLS (fine for internal Docker traffic)
  // In production, use grpc.ServerCredentials.createSsl() with certs
  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('[gRPC] Failed to start gRPC server:', err.message);
      return;
    }
    console.log(`[gRPC] UserService gRPC server listening on port ${port}`);
  });

  return server;
};

module.exports = { startGrpcServer };
