# Step 3 — API Gateway

## Objective
Build the API Gateway — the single entry point for all client requests.
Every request from the React frontend passes through here before reaching
any downstream service.

After this step, the frontend talks only to port 3000. The gateway handles
rate limiting, JWT verification, and routing to the correct service.

---

## Files Created

```
backend/api-gateway/
├── Dockerfile
├── .dockerignore
├── package.json                        ← express, http-proxy-middleware, ioredis, jsonwebtoken
└── src/
    ├── index.js                        ← Startup: Redis ping, server.listen, graceful shutdown
    ├── app.js                          ← Middleware chain: CORS → log → rate limit → auth → proxy
    ├── config/
    │   └── redis.js                    ← isTokenBlacklisted(), checkRateLimit()
    ├── middleware/
    │   ├── auth.js                     ← JWT verify + blacklist check + inject X-User-Id header
    │   └── rateLimit.js                ← 100 req/min per IP using Redis fixed-window counter
    └── routes/
        └── proxy.js                    ← createServiceProxy() factory + one proxy per service
```

---

## Request Lifecycle

```
Client Request
    ↓
[1] CORS check          — is origin allowed?
    ↓
[2] Request logging     — morgan logs method + path
    ↓
[3] Rate limit          — has this IP exceeded 100 req/min?  → 429 if exceeded
    ↓
[4] JWT authentication  — valid token? not blacklisted?      → 401 if invalid
    ↓ (injects X-User-Id + X-User-Email headers)
[5] Proxy               — forward to matching service
    ↓
Downstream Service Response → streamed back to client
```

---

## Routing Table

| URL Prefix | Destination | Auth Required |
|---|---|---|
| `/api/auth/register` | auth-service:3001 | No |
| `/api/auth/login` | auth-service:3001 | No |
| `/api/auth/google` | auth-service:3001 | No |
| `/api/auth/google/callback` | auth-service:3001 | No |
| `/api/auth/logout` | auth-service:3001 | Yes |
| `/api/users/*` | user-service:3002 | Yes (Step 4) |
| `/api/swipes/*` | swipe-service:3003 | Yes (Step 5) |
| `/api/matches/*` | match-service:3004 | Yes (Step 6) |
| `/api/chat/*` | chat-service:3005 | Yes (Step 7) |
| `/api/notifications/*` | notification-service:3006 | Yes (Step 8) |

---

## How to Run

```bash
docker-compose up --build zookeeper kafka redis postgres-auth auth-service api-gateway frontend
```

---

## Testing

### Health check
```bash
curl http://localhost:3000/health
# { "service": "api-gateway", "status": "healthy" }
```

### Register through gateway (port 3000, not 3001 directly)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "securepass123"}'
```

### Login through gateway
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "securepass123"}'
```

### Hit a protected route without token (should 401)
```bash
curl http://localhost:3000/api/users/me
# { "error": "Access token required. Please log in." }
```

### Check rate limit headers on any response
```bash
curl -I http://localhost:3000/health
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: <unix timestamp>
```

---

## Key Design Decisions

### Why a custom gateway instead of nginx?
nginx is excellent for production but hard to extend. A custom Express gateway
lets us add business logic (JWT verification, blacklist check) directly in
code that's easy to read, test, and modify.

### Why inject X-User-Id instead of forwarding the JWT?
Verifying the JWT in every service would mean every service needs JWT_SECRET
and Redis access. Injecting a trusted header means services trust the gateway
to have done auth — simpler, less duplicated code.

### Why rate limit at the gateway?
Rate limits belong at the boundary of the system — the first thing that receives
traffic. Doing it at the gateway means one Redis key space, one config,
protecting all services simultaneously.

---

## Files Updated
- `docker-compose.yml` — added api-gateway service
- `frontend/vite.config.js` — proxy target changed from auth-service:3001 → api-gateway:3000

---

## Next Step

**Step 4 — User Service**

Build the User Service (Node.js + Express + PostgreSQL):
- Consume `user.created` Kafka event → create blank profile
- `GET /api/users/me` → get my profile
- `PUT /api/users/me` → update profile (name, bio, skills, GitHub, photo)
- `GET /api/users/:id` → get another user's profile (for swipe cards)
- gRPC server → respond to profile lookup calls from Match Service (Step 6)
