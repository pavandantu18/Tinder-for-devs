# =============================================================================
# Dockerfile
# Service: auth-service
#
# PURPOSE:
#   Defines how to build a Docker image for the Auth Service.
#   Docker reads this file top-to-bottom and executes each instruction
#   to produce a layered image that can be run as a container.
#
# MULTI-STAGE BUILD (not used here — kept simple for learning):
#   For production we'd use multi-stage builds to create a smaller final image.
#   For now, a single stage is clear and easy to understand.
#
# LAYER CACHING EXPLAINED:
#   Docker caches each instruction as a "layer". If a layer hasn't changed,
#   Docker reuses the cached version instead of re-running it.
#   This is why we COPY package.json and run npm install BEFORE copying
#   the rest of the source code — the node_modules layer only rebuilds
#   when dependencies change, not on every code change.
# =============================================================================

# Use Node.js 20 on Alpine Linux.
# Alpine is a minimal Linux distro (~5MB) vs Ubuntu (~70MB).
# The "20-alpine" tag pins to Node 20 — stable LTS version.
FROM node:20-alpine

# Set the working directory inside the container.
# All subsequent commands (COPY, RUN, CMD) operate relative to this path.
# The directory is created automatically if it doesn't exist.
WORKDIR /app

# ─── DEPENDENCY INSTALLATION ─────────────────────────────────────────────────
# Copy ONLY package.json and package-lock.json first.
# This layer is cached separately from the source code.
# Result: `npm install` only re-runs when dependencies change,
# not every time you change a .js file. Saves significant build time.
COPY package*.json ./

# Install production dependencies only.
# --omit=dev skips devDependencies (like nodemon) in the final image.
# In development we use `docker-compose` with volumes, so nodemon
# runs from the mounted source code, not from inside the image.
RUN npm install --omit=dev

# ─── SOURCE CODE ─────────────────────────────────────────────────────────────
# Copy the entire service source code into the container.
# This runs AFTER npm install so source changes don't invalidate
# the node_modules cache layer above.
COPY . .

# ─── RUNTIME ─────────────────────────────────────────────────────────────────
# Expose port 3001 — the port the Auth Service Express server binds to.
# This is documentation only; the actual port mapping is in docker-compose.yml.
EXPOSE 3001

# Start the Auth Service.
# CMD is the default command run when the container starts.
# Using array form (exec form) avoids spawning a shell, so signals
# like SIGTERM go directly to the Node.js process (important for graceful shutdown).
CMD ["node", "src/index.js"]
