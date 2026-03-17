# Step 4 — User Service

## Objective
Build the User Service: manages developer profiles, consumes `user.created`
Kafka events to create blank profiles, and exposes a gRPC server for
internal lookups by Match Service (Step 6).

---

## Files Created

```
backend/user-service/
├── Dockerfile
├── .dockerignore
├── package.json                     ← express, pg, kafkajs, @grpc/grpc-js, @grpc/proto-loader
└── src/
    ├── index.js                     ← Startup: DB → Kafka consumer → gRPC server → HTTP server
    ├── app.js                       ← Express setup, routes mounted at /api/users
    ├── config/
    │   ├── db.js                    ← pg.Pool for user_db
    │   └── kafka.js                 ← KafkaJS consumer for user.created topic
    ├── db/
    │   └── init.sql                 ← profiles table, is_complete flag, indexes
    ├── routes/user.routes.js        ← /me, /discover, /:id
    ├── controllers/user.controller.js
    ├── services/user.service.js     ← createBlankProfile, updateMyProfile, discoverProfiles
    ├── middleware/validate.js       ← requireUserId, validateProfileUpdate
    └── grpc/server.js               ← gRPC server: GetUserProfile, GetMultipleProfiles

proto/
└── user.proto                       ← Shared gRPC contract (User Service server, Match Service client)

frontend/src/
├── api/user.js                      ← getMyProfile, updateMyProfile, discoverProfiles
├── pages/ProfileEditPage.jsx        ← Profile edit form with skill tags
├── pages/DashboardPage.jsx          ← Updated: shows profile status, link to edit
└── styles/profile.css
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/users/me | Get my own profile |
| PUT | /api/users/me | Update my profile |
| GET | /api/users/discover | Paginated list of complete profiles for swipe feed |
| GET | /api/users/:id | Get any user's public profile |

---

## Kafka

**Consumes:** `user.created`
- Produced by Auth Service after registration
- Action: `INSERT INTO profiles (id) VALUES ($1) ON CONFLICT DO NOTHING`
- Idempotent — safe if event is delivered more than once

---

## gRPC (port 50052)

**Serves:** `UserService` defined in `proto/user.proto`
- `GetUserProfile(userId)` → returns one UserProfile
- `GetMultipleProfiles(userIds[])` → returns array of UserProfiles
- Called by Match Service in Step 6

---

## Profile Completion

A profile is `is_complete = true` when:
- `name` is set AND
- `skills` array has at least one entry

Only complete profiles appear in `/discover`. This prevents blank profiles
(created automatically on registration) from cluttering the swipe feed.

---

## How to Run

```bash
docker-compose up --build zookeeper kafka redis postgres-auth postgres-user auth-service user-service api-gateway frontend
```

---

## Testing

### Get my profile (after login)
```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update profile
```bash
curl -X PUT http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Dev","bio":"Full-stack dev","skills":["React","Node.js"],"github_url":"https://github.com/janedev"}'
```

### Discover other developers
```bash
curl "http://localhost:3000/api/users/discover?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Verify profile was created by Kafka event
```bash
docker exec devmatch-postgres-user psql -U user_user -d user_db \
  -c "SELECT id, name, is_complete FROM profiles;"
```

---

## Next Step

**Step 5 — Swipe Service**
- `POST /api/swipes` — record LIKE or PASS
- Prevent duplicate swipes (unique constraint on swiper_id + target_id)
- Emit `swipe.created` Kafka event
- Update `/discover` to exclude already-swiped profiles
