// =============================================================================
// src/grpc/userClient.js — match-service
//
// PURPOSE:
//   gRPC CLIENT for the User Service.
//   Called by GET /api/matches to enrich match records with profile data
//   (name, photo, skills) so the frontend doesn't need a second request.
//
// RPCS CALLED:
//   GetMultipleProfiles(user_ids[]) → { profiles: Profile[] }
// =============================================================================

const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../../proto/user.proto');

const packageDef = loader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
});

const userProto = grpc.loadPackageDefinition(packageDef).user;

const USER_GRPC_HOST = process.env.USER_GRPC_HOST || 'user-service:50052';

const userClient = new userProto.UserService(
  USER_GRPC_HOST,
  grpc.credentials.createInsecure()
);

// ---------------------------------------------------------------------------
// getMultipleProfiles(userIds)
//
// Fetches profile data for a list of user IDs in one gRPC call.
// Used to enrich GET /api/matches with name, photo_url, skills.
//
// RETURNS: Profile[] (only found profiles — missing IDs are silently omitted)
// ---------------------------------------------------------------------------
const getMultipleProfiles = (userIds) => {
  return new Promise((resolve, reject) => {
    userClient.GetMultipleProfiles(
      { user_ids: userIds },
      (err, response) => {
        if (err) return reject(err);
        resolve(response.profiles || []);
      }
    );
  });
};

module.exports = { getMultipleProfiles };
