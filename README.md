# DevMatch — Developer Tinder

A full-stack, production-style Tinder clone built for developers. Swipe on other developers, match with people who share your stack, and chat in real time.

Built as a learning project to demonstrate microservices architecture, event-driven design, real-time communication, and modern frontend patterns.

---

## What it Does

- Register / log in with email+password or Google OAuth
- Set up your developer profile (name, bio, skills, GitHub, photo)
- Swipe right to like, left to pass on other developers
- Mutual likes create a match → both users are notified instantly
- Chat with matches via real-time WebSocket messaging
- Receive in-app notifications (bell icon) for new matches and messages

---

## Tech Stack

### Frontend
| Technology | Role |
|---|---|
| React 19 | UI library |
| Vite | Dev server + bundler |
| React Router v6 | Client-side routing |
| Socket.IO client | Real-time chat WebSocket |
| CSS (custom) | Glassmorphism dark theme |

### Backend — Microservices (Node.js)
| Service | Port | Responsibility |
|---|---|---|
| **API Gateway** | 3000 | Single entry point — rate limiting, JWT verification, request proxying |
| **Auth Service** | 3001 | Register, login, logout, Google OAuth, JWT issuance |
| **User Service** | 3002 | Developer profiles (CRUD), discovery feed |
| **Swipe Service** | 3003 | Record LIKE/PASS swipes |
| **Match Service** | 3004 | Detect mutual likes, create matches |
| **Chat Service** | 3005 | Real-time messaging (Socket.IO + MongoDB) |
| **Notification Service** | 3006 | In-app notifications via SSE |

### Infrastructure
| Technology | Role |
|---|---|
| Apache Kafka | Async event bus between services |
| ZooKeeper | Kafka cluster coordination |
| Redis | JWT blacklist (logout) + API rate limiting |
| PostgreSQL × 5 | One database per service (auth, user, swipe, match, notification) |
| MongoDB | Chat message storage |
| Docker + Docker Compose | Container orchestration |

### Inter-Service Communication
| Pattern | Used For |
|---|---|
| **Kafka** (async) | user.created → swipe.created → match.created → message.sent |
| **gRPC** (sync) | Profile lookups, swipe checks, match verification |
| **HTTP proxy** | API Gateway → downstream services |
| **SSE** | Server-Sent Events for real-time notification delivery |

---

## Architecture

```
Browser (React)
      │
      ▼ HTTP + WebSocket
┌─────────────┐
│ API Gateway │  ← rate limiting, JWT check, proxy
│   :3000     │
└──────┬──────┘
       │ routes by path prefix
       ├──/api/auth/*──────► Auth Service :3001
       ├──/api/users/*─────► User Service :3002
       ├──/api/swipes/*────► Swipe Service :3003
       ├──/api/matches/*───► Match Service :3004
       ├──/api/chat/*──────► Chat Service :3005
       ├──/socket.io/*─────► Chat Service :3005  (WebSocket upgrade)
       └──/api/notifications* Notification Service :3006

                   Kafka Event Bus
    ┌────────────────────────────────────────────┐
    │  user.created  ──────────────────────────► User Service (creates blank profile)
    │  swipe.created ──────────────────────────► Match Service (check mutual like)
    │  match.created ──────────────────────────► Chat Service (register room)
    │  match.created ──────────────────────────► Notification Service (match alert)
    │  message.sent  ──────────────────────────► Notification Service (message alert)
    └────────────────────────────────────────────┘

                   gRPC Calls
    User Service   ──GetSwipedUserIds──────────► Swipe Service :50053
    Match Service  ──CheckMutualLike────────────► Swipe Service :50053
    Match Service  ──GetMultipleProfiles────────► User Service :50052
    Chat Service   ──CheckMatchExists───────────► Match Service :50054
    Chat Service   ──GetUserProfile─────────────► User Service :50052
```

---

## Prerequisites

Install these before you begin:

1. **Docker Desktop** — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
   Runs all infrastructure (Kafka, Postgres, Redis, MongoDB) and services in containers.

2. **Git** — [git-scm.com](https://git-scm.com)
   To clone the repository.

3. **Node.js 20+** *(optional)* — [nodejs.org](https://nodejs.org)
   Only needed if you want to run services outside Docker for debugging.

Verify Docker is running:
```bash
docker --version
docker compose version
```

---

## Setup — Getting It Running Locally

### Step 1 — Clone the repository

```bash
https://github.com/pavandantu18/Tinder-for-devs.git
cd Tinder-for-devs
```

### Step 2 — Create the environment file

There is no `.env` file in the repo (it contains secrets and is gitignored).
Create one at the **project root**:

```bash
# In the project root (same folder as docker-compose.yml)
touch .env
```

Then open it and paste the following, filling in your own values:

```env
# ── Node ──────────────────────────────────────────────────────────────────────
NODE_ENV=development

# ── Service ports ─────────────────────────────────────────────────────────────
API_GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
USER_SERVICE_PORT=3002

# ── Kafka ─────────────────────────────────────────────────────────────────────
KAFKA_BROKER=kafka:9092

# ── Redis ─────────────────────────────────────────────────────────────────────
# Leave empty for no Redis password (fine for local dev)
REDIS_PASSWORD=

# ── JWT ───────────────────────────────────────────────────────────────────────
# Any long random string — used to sign and verify tokens
JWT_SECRET=change_this_to_a_long_random_secret_string
JWT_EXPIRES_IN=7d

# ── PostgreSQL — Auth Service ─────────────────────────────────────────────────
POSTGRES_AUTH_USER=auth_user
POSTGRES_AUTH_PASSWORD=auth_pass

# ── PostgreSQL — User Service ─────────────────────────────────────────────────
POSTGRES_USER_USER=user_user
POSTGRES_USER_PASSWORD=user_pass

# ── PostgreSQL — Swipe Service ────────────────────────────────────────────────
POSTGRES_SWIPE_USER=swipe_user
POSTGRES_SWIPE_PASSWORD=swipe_pass

# ── PostgreSQL — Match Service ────────────────────────────────────────────────
POSTGRES_MATCH_USER=match_user
POSTGRES_MATCH_PASSWORD=match_pass

# ── PostgreSQL — Notification Service ────────────────────────────────────────
POSTGRES_NOTIFICATION_USER=notif_user
POSTGRES_NOTIFICATION_PASSWORD=notif_pass

# ── MongoDB — Chat Service ────────────────────────────────────────────────────
MONGO_CHAT_USER=chat_user
MONGO_CHAT_PASSWORD=chat_pass

# ── Google OAuth (optional — skip if you don't need Google login) ─────────────
# Get these from: https://console.cloud.google.com/ → APIs & Services → Credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

> **Google OAuth**: If you skip the Google credentials, email/password login still works.
> If you want Google login, see [Google OAuth Setup](#google-oauth-setup) below.

### Step 3 — Start everything

```bash
docker compose up --build
```

The first run takes a few minutes — Docker pulls images (~2 GB) and builds the service containers.

Watch for these lines to know it's ready:
```
devmatch-auth-service       | Auth service running on port 3001
devmatch-user-service       | User service running on port 3002
devmatch-api-gateway        | API Gateway running on port 3000
devmatch-frontend           | ➜  Local: http://localhost:5173/
```

### Step 4 — Open the app

Go to [http://localhost:5173](http://localhost:5173)

Register an account, fill out your profile, and start swiping.

---

## Running in the Background

```bash
# Start detached (no log output in terminal)
docker compose up -d --build

# View logs for a specific service
docker compose logs -f chat-service

# Stop everything (data is preserved)
docker compose down

# Stop everything AND delete all data (fresh start)
docker compose down -v
```

---

## Port Reference

| Service | Host Port | Notes |
|---|---|---|
| React frontend | 5173 | Vite dev server |
| API Gateway | 3000 | All traffic enters here |
| Auth Service | 3001 | Direct access for debugging |
| User Service | 3002 | Direct access for debugging |
| Swipe Service | 3003 | Direct access for debugging |
| Match Service | 3004 | Direct access for debugging |
| Chat Service | 3005 | Direct access for debugging |
| Notification Service | 3006 | Direct access for debugging |
| Kafka (external) | 9093 | Connect with Kafka UI tools |
| Redis | 6379 | `redis-cli -p 6379` |
| PostgreSQL Auth | 5432 | `psql -h localhost -p 5432 -U auth_user -d auth_db` |
| PostgreSQL User | 5433 | `psql -h localhost -p 5433 -U user_user -d user_db` |
| PostgreSQL Swipe | 5434 | `psql -h localhost -p 5434 -U swipe_user -d swipe_db` |
| PostgreSQL Match | 5435 | `psql -h localhost -p 5435 -U match_user -d match_db` |
| PostgreSQL Notification | 5436 | `psql -h localhost -p 5436 -U notif_user -d notification_db` |
| MongoDB Chat | 27017 | `mongosh "mongodb://chat_user:chat_pass@localhost:27017/chat_db"` |

---

## How to Read the Code

### Project Structure

```
devmatch/
├── docker-compose.yml          # Orchestrates every service + infrastructure
├── .env                        # Your secrets (gitignored — you create this)
├── frontend/                   # React app (Vite)
│   ├── src/
│   │   ├── api/                # Axios functions — one file per backend domain
│   │   ├── components/         # Reusable UI components (NavBar, Icons, etc.)
│   │   ├── context/            # React Context (AuthContext, NotificationContext)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/              # One component per route/screen
│   │   └── styles/             # CSS files — one per page/component
│   └── vite.config.js          # Dev server config + /api proxy
│
└── backend/
    ├── api-gateway/            # Entry point — proxies all requests
    ├── auth-service/           # Registration, login, JWT, Google OAuth
    ├── user-service/           # Developer profiles + discovery feed
    ├── swipe-service/          # Swipe recording + gRPC server
    ├── match-service/          # Mutual like detection + match creation
    ├── chat-service/           # Socket.IO real-time chat + MongoDB
    └── notification-service/   # SSE real-time notifications
```

### Inside Each Backend Service

Every service follows the same folder structure:

```
<service>/
├── Dockerfile              # Container build instructions
├── package.json            # Dependencies
├── proto/                  # gRPC .proto files (self-contained per service)
└── src/
    ├── index.js            # Entry point — starts HTTP server
    ├── app.js              # Express setup — mounts routes + middleware
    ├── config/
    │   ├── db.js           # Database connection (PostgreSQL pool or Mongoose)
    │   ├── kafka.js        # Kafka producer + consumer setup
    │   └── redis.js        # Redis client (auth + api-gateway only)
    ├── controllers/        # Request handlers — validate → call service → respond
    ├── services/           # Business logic — does the actual work
    ├── routes/             # Express route definitions
    ├── middleware/         # Auth checks, request validation
    ├── db/                 # Database schema + migration SQL
    └── grpc/               # gRPC server or client code
```

### Reading Order — Start Here

If you're exploring the codebase for the first time, follow this order:

1. **`docker-compose.yml`** — Understand the full system: every service, how they connect, what databases they own. Each section has detailed comments explaining the "why".

2. **`backend/api-gateway/src/app.js`** — All client traffic enters here. See how requests are routed to downstream services and how JWT is verified before proxying.

3. **`backend/auth-service/src/`** — Simplest service. Understand the controller → service → database pattern here before moving on.

4. **`backend/user-service/src/`** — Adds Kafka consumption (listens for `user.created`) and a gRPC server. Two new patterns to learn.

5. **`backend/swipe-service/src/`** — Adds Kafka production (emits `swipe.created`) and a gRPC server with two RPCs.

6. **`backend/match-service/src/`** — Uses Kafka (consume `swipe.created`, emit `match.created`) AND gRPC clients (calls Swipe + User services). Most complex inter-service flow.

7. **`backend/chat-service/src/socket/index.js`** — Socket.IO authentication and real-time message handling. Understand how JWT auth works over WebSocket.

8. **`backend/notification-service/src/`** — SSE delivery. See how the server pushes events to connected browsers without the client polling.

9. **`frontend/src/`** — React app. Start with `App.jsx` (routing), then `context/AuthContext.jsx` (how auth state is shared), then individual pages.

### Key Patterns

**Kafka event flow** — The backbone of the app. When something happens (user registered, swipe recorded, match created), the service emits a Kafka event and moves on. Other services subscribe independently and react when ready. No direct service-to-service HTTP calls for these flows — they're fully decoupled.

```
Auth registers user
  → emits user.created
    → User Service creates blank profile
```

```
Swipe Service records LIKE
  → emits swipe.created
    → Match Service checks if it's mutual
      → emits match.created
        → Chat Service registers a chat room
        → Notification Service alerts both users
```

**gRPC for synchronous lookups** — When a service needs data from another service right now (not eventually), it uses gRPC. For example, Match Service needs to know "did User A already like User B?" before it can confirm a match. That answer is needed immediately, so it's a gRPC call to Swipe Service.

**Database per service** — Each service owns its data. Auth Service cannot query User Service's database directly. It must go through the API. This is the microservices contract.

**JWT flow** — Auth Service issues a JWT on login. The client stores it and sends it with every request. API Gateway verifies the token signature and checks the Redis blacklist (for logged-out tokens) before proxying the request downstream.

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Set Application type: **Web application**
6. Add to **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
7. Copy the **Client ID** and **Client Secret** into your `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```
8. Rebuild the auth service:
   ```bash
   docker compose up --build auth-service
   ```

---

## Common Issues

**`auth-service` is unavailable / keeps restarting**
Usually means Kafka isn't ready yet. Wait 30–60 seconds after starting — Kafka takes time to initialize. The service has `restart: unless-stopped` so it will come up automatically once Kafka is healthy.

If it still fails after 2 minutes:
```bash
docker compose logs kafka
docker compose restart auth-service
```

**Kafka `NodeExistsException` in logs**
ZooKeeper has a stale node from a previous crashed Kafka instance. Fix:
```bash
docker compose stop kafka zookeeper
docker compose start zookeeper
# Wait ~15 seconds for ZooKeeper to be healthy
docker compose start kafka
```

**Port already in use**
Another process is using one of the ports. Find and stop it, or change the host port in `docker-compose.yml` (left side of `"host:container"`).

**`docker compose up` is slow on first run**
Normal — Docker is pulling ~2 GB of images (Kafka, Postgres, Redis, MongoDB, Node). Subsequent starts are fast.

**Messages not showing in notifications after app restart**
The chat service rebuilds its in-memory room map from Kafka on every restart (consumer group is set to replay from beginning). Allow 5–10 seconds after startup.

---

## Development Tips

**Rebuild a single service after code changes:**
```bash
docker compose up --build auth-service
```

**View real-time logs for all services:**
```bash
docker compose logs -f
```

**Connect to a database directly:**
```bash
# PostgreSQL example
psql -h localhost -p 5432 -U auth_user -d auth_db

# MongoDB example
mongosh "mongodb://chat_user:chat_pass@localhost:27017/chat_db"

# Redis example
redis-cli -p 6379
```

**Watch Kafka events in real time** (useful for debugging the event flow):
```bash
docker exec -it devmatch-kafka \
  kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic match.created \
  --from-beginning
```

Available topics: `user.created`, `swipe.created`, `match.created`, `message.sent`
