# Step 1 — Infrastructure Setup

## Objective
Spin up all local infrastructure that the DevMatch microservices depend on:
ZooKeeper, Kafka, Redis, four PostgreSQL instances, and one MongoDB instance.

After this step, none of the application code exists yet — but all the databases
and message brokers are running and healthy, ready for services to connect.

---

## What We Set Up

| Container | Image | Purpose | Host Port |
|---|---|---|---|
| devmatch-zookeeper | cp-zookeeper:7.5.0 | Kafka cluster coordination | 2181 |
| devmatch-kafka | cp-kafka:7.5.0 | Async event bus | 9092 (internal), 9093 (external) |
| devmatch-redis | redis:7.2-alpine | Rate limiting + JWT blacklist | 6379 |
| devmatch-postgres-auth | postgres:16-alpine | Auth DB (credentials) | 5432 |
| devmatch-postgres-user | postgres:16-alpine | User DB (profiles) | 5433 |
| devmatch-postgres-swipe | postgres:16-alpine | Swipe DB (swipe records) | 5434 |
| devmatch-postgres-match | postgres:16-alpine | Match DB (confirmed matches) | 5435 |
| devmatch-mongo-chat | mongo:7.0 | Chat DB (message documents) | 27017 |

---

## Prerequisites

- Docker Desktop installed and running
- `.env` file exists in the project root (copy from `.env.example` if not)

---

## How to Run

### Start infra only (Step 1 — no application services yet)
```bash
docker-compose up zookeeper kafka redis postgres-auth postgres-user postgres-swipe postgres-match mongo-chat
```

### Start in background (detached mode)
```bash
docker-compose up -d zookeeper kafka redis postgres-auth postgres-user postgres-swipe postgres-match mongo-chat
```

### Verify all containers are healthy
```bash
docker-compose ps
```
All listed services should show `healthy` in the Status column.
Kafka may take 30-60 seconds to become healthy — this is normal.

---

## Verifying Each Service Works

### Check ZooKeeper
```bash
# Should see ZooKeeper responding on port 2181
docker exec devmatch-zookeeper nc -z localhost 2181 && echo "ZooKeeper OK"
```

### Check Kafka
```bash
# List Kafka topics (should return empty list since no services have connected yet)
docker exec devmatch-kafka kafka-topics --bootstrap-server localhost:9092 --list
```

### Check Redis
```bash
# Should respond with PONG
docker exec devmatch-redis redis-cli ping
```

### Check Auth DB (PostgreSQL)
```bash
# Connect and list databases
docker exec devmatch-postgres-auth psql -U auth_user -d auth_db -c "\l"
```

### Check User DB (PostgreSQL)
```bash
docker exec devmatch-postgres-user psql -U user_user -d user_db -c "\l"
```

### Check Swipe DB (PostgreSQL)
```bash
docker exec devmatch-postgres-swipe psql -U swipe_user -d swipe_db -c "\l"
```

### Check Match DB (PostgreSQL)
```bash
docker exec devmatch-postgres-match psql -U match_user -d match_db -c "\l"
```

### Check MongoDB
```bash
# Should respond with { ok: 1 }
docker exec devmatch-mongo-chat mongosh --eval "db.adminCommand('ping')" --quiet
```

---

## Startup Order (enforced by depends_on + healthchecks)

```
ZooKeeper starts first
    ↓ (kafka waits until zookeeper is healthy)
Kafka starts
    ↓
Redis, postgres-auth, postgres-user, postgres-swipe, postgres-match, mongo-chat
    (these all start in parallel — no dependencies between them)
```

Application services (auth-service, user-service, etc.) will each declare
`depends_on` on their specific database AND on kafka before starting.

---

## Useful Commands

```bash
# View logs for a specific service
docker-compose logs -f kafka

# Restart a single service without stopping others
docker-compose restart postgres-auth

# Stop everything but keep volume data
docker-compose down

# Full reset — stops containers AND deletes all volume data (fresh DB state)
docker-compose down -v

# Check which containers are running
docker ps

# Get a shell inside a container
docker exec -it devmatch-kafka bash
```

---

## Files Created in This Step

```
Tinder_Developers/
├── docker-compose.yml      ← All infra + placeholder comments for app services
├── .env                    ← Real secrets (gitignored)
├── .env.example            ← Safe-to-commit variable template
├── .gitignore              ← Keeps secrets and generated files out of git
├── proto/                  ← Empty — gRPC .proto files added in Step 6
├── services/               ← Empty — one folder per service, built in steps 2-8
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── swipe-service/
│   ├── match-service/
│   ├── chat-service/
│   └── notification-service/
├── client/                 ← Empty — React app built in Step 9
└── workflows/
    └── step1_infra_setup.md   ← This file
```

---

## Known Issues & Notes

- **Kafka takes ~30-60 seconds to become healthy** after ZooKeeper is ready.
  This is normal — Kafka needs to register with ZooKeeper and load its state.
  If `docker-compose ps` shows Kafka as unhealthy, wait another 30 seconds and check again.

- **Port conflicts**: If you have a local PostgreSQL running on port 5432,
  the `postgres-auth` container will fail to bind. Stop your local Postgres first,
  or change the host port in docker-compose.yml (e.g., `5442:5432`).

- **Docker Desktop memory**: Running 8 containers requires ~2-3GB RAM.
  Ensure Docker Desktop has at least 4GB allocated (Settings → Resources → Memory).

---

## Next Step

**Step 2 — Auth Service**

Build the Auth Service (Node.js + Express):
- `POST /register` → hash password, save to auth_db, emit `user.created` Kafka event
- `POST /login` → verify credentials, issue JWT
- `POST /logout` → add JWT to Redis blacklist
- `GET /google` → Google OAuth redirect
- `GET /google/callback` → Google OAuth callback, issue JWT
