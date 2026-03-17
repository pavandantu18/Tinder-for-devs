# =============================================================================
# Dockerfile — match-service
# BUILD CONTEXT: project root (needs proto/ directory)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

COPY backend/match-service/package*.json ./
RUN npm install --omit=dev

COPY backend/match-service/ .
COPY proto/ ./proto/

# Port 3004 — HTTP API
# Port 50054 — gRPC server (called by Chat Service in Step 7)
EXPOSE 3004
EXPOSE 50054

CMD ["node", "src/index.js"]
