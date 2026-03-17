# 🚀 Tinder — High-Level System Design

A scalable, event-driven microservices platform that connects developers through swipe-based matching, real-time chat, and skill-based discovery.

---

# 🛠️ Tech Stack

## Frontend
- **React** — UI framework
- **Axios** — HTTP client for REST API calls
- **Socket.io-client** — WebSocket connection for real-time chat
- **React Router** — Client-side routing

## Backend (per service)
- **Node.js + Express** — HTTP server for each microservice
- **@grpc/grpc-js + @grpc/proto-loader** — gRPC client/server for internal service-to-service calls
- **kafkajs** — Kafka producer/consumer for async event streaming
- **jsonwebtoken** — JWT creation and verification
- **bcryptjs** — Password hashing
- **socket.io** — WebSocket server (Chat Service only)

## Databases (per service — no shared DB)
| Service | Database | Why |
|---|---|---|
| Auth | PostgreSQL | Structured credentials, ACID compliance |
| User | PostgreSQL | Structured profiles, relational queries |
| Swipe | PostgreSQL | Structured swipe records, fast reverse-swipe lookup |
| Match | PostgreSQL | Relational match pairs |
| Chat | MongoDB | Flexible document storage for message history |

## Infrastructure
- **Redis** — Session caching, API Gateway rate limiting
- **Apache Kafka + ZooKeeper** — Async event bus between services
- **Docker + Docker Compose** — Local orchestration of all services and infrastructure
- **API Gateway** — Custom Express gateway using `http-proxy-middleware`

---

# 🐳 Local Development (Docker Compose)

All services and infrastructure run locally via Docker Compose:

```
docker-compose up
```

**Services spun up:**
- `zookeeper` — Required by Kafka for cluster coordination
- `kafka` — Message broker (topics: user.created, swipe.created, match.created, message.sent)
- `redis` — Caching + rate limiting for API Gateway
- `postgres-auth` — PostgreSQL instance for Auth Service
- `postgres-user` — PostgreSQL instance for User Service
- `postgres-swipe` — PostgreSQL instance for Swipe Service
- `postgres-match` — PostgreSQL instance for Match Service
- `mongo-chat` — MongoDB instance for Chat Service
- `api-gateway` — Entry point for all client requests (port 3000)
- `auth-service` — Handles login, registration, JWT (port 3001)
- `user-service` — Handles profiles (port 3002)
- `swipe-service` — Handles swipe actions (port 3003)
- `match-service` — Detects mutual matches (port 3004)
- `chat-service` — Real-time messaging via WebSockets (port 3005)
- `notification-service` — Sends match/message alerts (port 3006)
- `client` — React frontend (port 5173)

---

# 🏗️ Build Order (Step-by-Step)

We build incrementally so each step produces a working system:

1. **Step 1 — Infra Setup**: Docker Compose with Kafka, ZooKeeper, Redis, all DBs
2. **Step 2 — Auth Service**: Register, login, JWT issuance, `user.created` Kafka event
3. **Step 3 — API Gateway**: JWT validation, request proxying to downstream services
4. **Step 4 — User Service**: Profile CRUD, consumes `user.created` from Kafka
5. **Step 5 — Swipe Service**: Record LIKE/PASS, emit `swipe.created` Kafka event
6. **Step 6 — Match Service**: Consume `swipe.created`, detect mutual swipe, emit `match.created`, gRPC call to User Service
7. **Step 7 — Chat Service**: WebSocket rooms per match, store messages in MongoDB, emit `message.sent`
8. **Step 8 — Notification Service**: Consume `match.created` + `message.sent`, send in-app alerts
9. **Step 9 — React Frontend**: Swipe UI, auth flow, real-time chat

---

# 📝 Documentation Standard

Every file in this project follows this commenting standard:
- **Top of file**: What this file does and which service it belongs to
- **Above each function**: What it does, what it takes as input, what it returns
- **Above complex logic**: Why it works this way (not just what it does)
- **Above Kafka producers/consumers**: Which topic, what triggers it, who listens
- **Above gRPC calls**: Which service is being called and why

Goal: reading only the comments should give a complete picture of the system.

---

# 🧠 Architecture Overview

DevMatch follows a **hybrid distributed architecture**:

* 🌐 **HTTP (REST)** → Client communication
* ⚡ **gRPC** → Internal synchronous communication
* 🔄 **Kafka** → Asynchronous event-driven workflows

---

# 🏗️ System Architecture

```id="arch1"
Client (React Web / Mobile)
        ↓ HTTP
API Gateway
        ↓
-------------------------------------------------------
|                Microservices Layer                  |
|                                                     |
|  Auth Service                                       |
|  User Service                                       |
|  Swipe Service                                      |
|  Match Service                                      |
|  Chat Service                                       |
|  Notification Service                               |
-------------------------------------------------------
        ↓
-----------------------------------------
| Communication Layer                   |
|                                       |
|  gRPC (Sync Service Calls)            |
|  Kafka (Async Event Streaming)        |
-----------------------------------------
        ↓
Databases (Per Service)
```

---

# 🧩 Core Services & Responsibilities

## 🔐 Auth Service

Handles authentication and identity.

**Supports:**

* Email/Password login
* Google OAuth

**Responsibilities:**

* User authentication
* Password hashing
* JWT token issuance
* Session management

**Emits Events:**

* `user.created`
* `user.logged_in`

---

## 👤 User Service

Manages developer profiles.

**Responsibilities:**

* Profile creation & updates
* Skills, bio, GitHub links
* Preferences & filters

**Consumes:**

* `user.created`

---

## 👉 Swipe Service

Handles swipe actions.

**Responsibilities:**

* Record LIKE / PASS
* Prevent duplicate swipes

**Emits:**

* `swipe.created`

---

## ❤️ Match Service

Detects mutual matches.

**Responsibilities:**

* Listen to swipe events
* Check reverse swipes
* Create matches

**Consumes:**

* `swipe.created`

**Uses gRPC:**

* Fetch user details from User Service

**Emits:**

* `match.created`

---

## 💬 Chat Service

Handles messaging.

**Responsibilities:**

* Real-time chat (WebSockets)
* Store chat history
* Manage chat rooms

**Consumes:**

* `match.created`

**Emits:**

* `message.sent`

---

## 🔔 Notification Service

Handles alerts and notifications.

**Responsibilities:**

* Match notifications
* Message notifications

**Consumes:**

* `match.created`
* `message.sent`

---

# 🔄 Communication Model

## 🌐 HTTP (External)

Used for:

* Client → API Gateway
* User actions (swipe, fetch, login)

---

## ⚡ gRPC (Internal)

Used for:

* Service-to-service queries

Examples:

* Match → User (fetch profile)
* Chat → User (fetch sender info)

---

## 🔄 Kafka (Async Events)

### Topics:

```id="topics"
- user.created
- swipe.created
- match.created
- message.sent
```

---

# 🔁 Key Workflows

---

## 🟢 Swipe → Match Flow

```id="flow1"
1. User swipes right
2. Swipe Service emits `swipe.created`
3. Match Service consumes event
4. Checks reverse swipe
5. If mutual:
   → Create match
   → Emit `match.created`
6. Chat Service creates room
7. Notification Service alerts users
```

---

## 💬 Messaging Flow

```id="flow2"
1. User sends message (WebSocket)
2. Chat Service stores message
3. Emits `message.sent`
4. Notification Service sends alert
```

---

## 🔐 Authentication Flow

```id="flow3"
1. User logs in (Email or Google)
2. Auth Service verifies credentials
3. JWT issued
4. Client stores token
5. API Gateway validates token
6. Request forwarded with userId
```

---

# 🔐 Security Design

* JWT-based authentication
* API Gateway enforces auth
* Password hashing (bcrypt)
* HTTPS enforced
* Rate limiting at Gateway

---

# 💾 Database Strategy

Each service owns its own database:

* Auth → Auth DB
* User → User DB
* Swipe → Swipe DB
* Match → Match DB
* Chat → Chat DB

**Principle:** No shared database

---

# ⚡ Real-Time Layer

* WebSockets (Socket.io)
* Chat Service manages rooms
* Each match = one room

---

# 🧠 Design Principles

* Microservices Architecture
* Event-Driven Design
* CQRS (Command vs Query separation)
* Loose Coupling via Kafka
* High-performance internal calls via gRPC

---

# 📈 Scalability Strategy

* Horizontal scaling of services
* Kafka partitions for throughput
* API Gateway load balancing
* Redis (future caching layer)
* Kubernetes (future orchestration)

---

# ⚠️ Key Considerations

* Eventual consistency between services
* Idempotent event handling
* Retry mechanisms for failures
* Dead Letter Queue (DLQ) for failed events

---

# 🔮 Future Enhancements

* AI-based developer matching
* GitHub integration & scoring
* Project collaboration system
* Advanced search (ElasticSearch)
* GraphQL Gateway
* Kubernetes for production orchestration (replacing Docker Compose)
* nginx as production API Gateway (replacing custom Express gateway)

---

# 🏁 Final Summary

DevMatch combines:

* 🌐 HTTP → Client interaction
* ⚡ gRPC → Fast internal communication
* 🔄 Kafka → Event-driven workflows

This architecture ensures a **scalable, resilient, and production-ready system** suitable for real-world applications.

---
