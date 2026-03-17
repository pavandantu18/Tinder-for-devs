// grpc/userClient.js — chat-service
// Calls User Service to fetch a user's display name on socket connect.

const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const PROTO = path.join(__dirname, '../../proto/user.proto');

const pkg = grpc.loadPackageDefinition(
  loader.loadSync(PROTO, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
);

const client = new pkg.user.UserService(
  process.env.GRPC_USER_SERVICE_ADDRESS || 'user-service:50052',
  grpc.credentials.createInsecure()
);

const getUserName = (userId) =>
  new Promise((resolve) => {
    client.GetUserProfile({ user_id: userId }, (err, res) => {
      if (err || !res) return resolve(null);
      resolve(res.name || null);
    });
  });

module.exports = { getUserName };
