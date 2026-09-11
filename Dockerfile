# =============================================================
# Maruf Bot - Production Dockerfile
# Based on Goat Bot V2 by NTKhang03 (MIT License)
# Multi-stage build: builder (compile native deps) → runtime (slim)
# =============================================================

# ---------- Stage 1: Builder ----------
FROM node:20-bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

# Build tools for canvas, sqlite3, bcrypt, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        pkg-config \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
        libpixman-1-dev \
        libffi-dev \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL deps (including dev) so native modules compile properly.
# NOT using --production so postinstall scripts (canvas rebuild) run.
RUN npm install --no-audit --no-fund --prefer-offline \
    && npm cache clean --force


# ---------- Stage 2: Runtime ----------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    TZ=Asia/Dhaka \
    DEBIAN_FRONTEND=noninteractive

# Runtime-only shared libs (NO compilers) + dumb-init for signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init \
        tini \
        ca-certificates \
        ffmpeg \
        libcairo2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libjpeg62-turbo \
        libgif7 \
        librsvg2-2 \
        libpixman-1-0 \
        libffi8 \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home nodejs

# Copy node_modules + app from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Persisted volumes (account, config, backups)
RUN mkdir -p /app/backups /app/logs \
    && chown -R nodejs:nodejs /app

VOLUME ["/app/backups", "/app/logs"]

USER nodejs

EXPOSE 8080

# Health check against built-in /health endpoint
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Graceful shutdown
STOPSIGNAL SIGTERM

# dumb-init ensures Node receives SIGTERM properly (clean shutdown)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]