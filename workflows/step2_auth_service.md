# Step 2 — Auth Service

## Objective
Build the Auth Service: a Node.js/Express microservice that handles user
registration, login, JWT issuance, logout (with Redis blacklist), and Google OAuth.

After this step, users can create accounts, log in, receive JWTs, and log out.
The service also emits a `user.created` Kafka event after registration, which
the User Service (Step 4) will consume to create a blank developer profile.

---

## Files Created

```
services/auth-service/
├── Dockerfile                          ← Builds the Node.js container image
├── .dockerignore                       ← Excludes node_modules, .env from build context
├── package.json                        ← Dependencies: express, pg, bcryptjs, kafkajs, etc.
└── src/
    ├── index.js                        ← Entry point: connects DB/Kafka/Redis, starts server
    ├── app.js                          ← Express setup: middleware, Passport, routes, error handler
    ├── config/
    │   ├── db.js                       ← PostgreSQL pool (pg.Pool) + query helper
    │   ├── kafka.js                    ← KafkaJS producer: connect, publishEvent, disconnect
    │   └── redis.js                    ← ioredis client: blacklistToken, isTokenBlacklisted
    ├── db/
    │   └── init.sql                    ← Creates credentials table, indexes, updated_at trigger
    ├── routes/
    │   └── auth.routes.js              ← Route definitions: maps URLs to middleware + controllers
    ├── controllers/
    │   └── auth.controller.js          ← HTTP layer: extract req fields, call service, return res
    ├── services/
    │   └── auth.service.js             ← Business logic: hashing, JWT, DB queries, Kafka events
    └── middleware/
        └── validate.js                 ← Input validation + JWT authentication middleware
```

---

## API Endpoints

| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create account with email + password |
| POST | /api/auth/login | No | Login, receive JWT |
| POST | /api/auth/logout | Yes (JWT) | Blacklist current token |
| GET | /api/auth/google | No | Redirect to Google OAuth |
| GET | /api/auth/google/callback | No | Google redirects here after login |
| GET | /api/auth/health | No | Service health check |

---

## Kafka Events

### Produces: `user.created`
**When:** A new user registers (email/password or Google OAuth)
**Payload:**
```json
{
  "userId": "uuid-v4",
  "email": "user@example.com",
  "createdAt": "2026-03-16T12:00:00.000Z"
}
```
**Who listens:** User Service (Step 4) — creates a blank developer profile

---

## How to Run

### Start infra + auth-service together
```bash
docker-compose up zookeeper kafka redis postgres-auth auth-service
```

### Build and start (force rebuild after code changes)
```bash
docker-compose up --build auth-service
```

### View auth-service logs
```bash
docker-compose logs -f auth-service
```

---

## Testing the API

### Register a new user
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "securepass123"}'

# Expected: 201 Created
# { "message": "Account created successfully", "userId": "...", "email": "..." }
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "securepass123"}'

# Expected: 200 OK
# { "message": "Login successful", "token": "eyJ...", "userId": "...", "email": "..." }
```

### Logout (blacklist the token)
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <token-from-login>"

# Expected: 200 OK
# { "message": "Logged out successfully" }
```

### Verify blacklisted token is rejected
```bash
# Using the same token after logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <same-token>"

# Expected: 401 Unauthorized
# { "error": "Token has been revoked. Please log in again." }
```

### Health check
```bash
curl http://localhost:3001/health
# Expected: { "service": "auth-service", "status": "healthy" }
```

### Verify user.created was published to Kafka
```bash
# Connect to Kafka container and consume from user.created topic
docker exec devmatch-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic user.created \
  --from-beginning

# Should print the JSON payload emitted when you registered above
```

### Check credentials in the database
```bash
docker exec devmatch-postgres-auth psql -U auth_user -d auth_db \
  -c "SELECT id, email, provider, created_at FROM credentials;"
```

---

## Key Design Decisions

### Why bcrypt for passwords?
bcrypt is a slow hashing algorithm by design. It takes ~300ms to hash,
making brute-force attacks impractical (an attacker trying millions of
passwords would take millions × 300ms = years). MD5/SHA-256 are fast,
so they're inappropriate for passwords.

### Why JWTs instead of sessions?
Sessions require server-side storage (a session table or Redis session store)
that all instances must share. JWTs are self-contained — any instance can
verify a JWT using just the secret, with no DB lookup. This makes horizontal
scaling (multiple auth-service instances) trivial.

### Why Redis for JWT blacklisting?
When a user logs out, their JWT is still cryptographically valid until
it expires. We can't "un-issue" a JWT. Redis lets us store the token's
jti (unique ID) with a TTL equal to the remaining token lifetime.
On every request, the API Gateway checks this blacklist in O(1) time.

### Why emit user.created instead of calling User Service directly?
Direct HTTP call: Auth Service → User Service
  - Auth depends on User Service being up
  - If User Service is down, registration fails
  - Services are tightly coupled

Kafka event: Auth Service → user.created topic → User Service
  - Auth Service doesn't know or care if User Service is up
  - If User Service is down, it catches up when it restarts
  - Services are loosely coupled

---

## Known Issues & Notes

- **Google OAuth**: Requires valid GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.
  For local testing, get these from console.cloud.google.com.
  Without them, the email/password flow still works — Google routes will return errors.

- **Kafka startup race**: auth-service may fail on first start if Kafka is still
  initializing. `restart: unless-stopped` in docker-compose.yml handles this —
  Docker will restart the container until Kafka is ready.

---

## Next Step

**Step 3 — API Gateway**

Build the API Gateway (Node.js + Express + http-proxy-middleware):
- Validate JWT on every incoming request
- Check JWT blacklist (Redis)
- Route requests to the correct downstream service
- Rate limiting per IP (Redis counters)
- Single entry point for the React client (port 3000)
