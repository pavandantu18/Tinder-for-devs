# =============================================================================
# Dockerfile
# Project: DevMatch Frontend
#
# PURPOSE:
#   Runs the Vite dev server inside Docker for local development.
#   The source code is mounted as a volume (in docker-compose.yml) so
#   changes on your machine are reflected instantly without rebuilding.
#
# FOR PRODUCTION:
#   Use a multi-stage build: stage 1 runs `npm run build`, stage 2 uses
#   nginx to serve the /dist static files. We'll add that later.
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer — only re-runs when package.json changes)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

# Start Vite dev server
CMD ["npm", "run", "dev"]
