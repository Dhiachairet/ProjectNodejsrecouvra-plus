# Stage 1: build the React app. Only its output (frontend/dist) reaches the final image,
# so Vite and the frontend dev dependencies never ship.
FROM node:24-alpine AS frontend
WORKDIR /build/frontend
# Manifests first: the npm ci layer stays cached until the frontend dependencies change
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: the API, which also serves the React build on the same port
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY swagger.yaml ./
COPY --from=frontend /build/frontend/dist ./frontend/dist
# The code stays owned by root, so the process cannot modify its own files
USER node
EXPOSE 3000
# Node running as PID 1 ignores SIGTERM, so docker stop would wait out its timeout (10 s by
# default) and then kill it. On SIGINT the app closes its MongoDB connection and exits with 0
# (src/config/db.js).
STOPSIGNAL SIGINT
CMD ["node", "src/server.js"]
