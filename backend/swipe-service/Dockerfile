# =============================================================================
# Dockerfile — swipe-service
# BUILD CONTEXT: project root (same reason as user-service — needs proto/)
# =============================================================================

FROM node:20-alpine

WORKDIR /app

COPY backend/swipe-service/package*.json ./
RUN npm install --omit=dev

COPY backend/swipe-service/ .
COPY proto/ ./proto/

EXPOSE 3003
EXPOSE 50053

CMD ["node", "src/index.js"]
