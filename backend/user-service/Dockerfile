# =============================================================================
# Dockerfile — user-service
#
# BUILD CONTEXT: project root (set in docker-compose.yml)
# This is required because user-service needs proto/user.proto which lives
# at the project root, outside the service directory.
#
# docker-compose.yml sets:
#   build:
#     context: .                                  ← project root
#     dockerfile: ./backend/user-service/Dockerfile
#
# All COPY paths below are relative to the project root.
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
# Source: backend/user-service/package*.json (relative to project root)
COPY backend/user-service/package*.json ./
RUN npm install --omit=dev

# Copy service source code
COPY backend/user-service/ .

# Copy the shared proto directory into the container at /app/proto/
# This is why we need the project root as build context.
# Match Service (Step 6) will need the same proto files.
COPY proto/ ./proto/

# Port 3002 — HTTP API (Express)
# Port 50052 — gRPC server (called by Match Service in Step 6)
EXPOSE 3002
EXPOSE 50052

CMD ["node", "src/index.js"]
