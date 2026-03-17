# =============================================================================
# Dockerfile — chat-service
# BUILD CONTEXT: project root (needs proto/match.proto)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

COPY backend/chat-service/package*.json ./
RUN npm install --omit=dev

COPY backend/chat-service/ .
COPY proto/ ./proto/

# Port 3005 — HTTP + WebSocket (Socket.IO upgrades the same connection)
EXPOSE 3005

CMD ["node", "src/index.js"]
