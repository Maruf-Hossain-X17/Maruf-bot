# =============================================================
# Maruf Bot - Production Dockerfile
# Based on Goat Bot V2 by NTKhang03 (MIT License)
# Customized by Maruf (https://github.com/maruf127679-pixel/Maruf-bot)
#
# Features:
#   - Multi-stage build (small image, fast rebuild)
#   - Non-root user (security)
#   - dumb-init (clean SIGTERM handling)
#   - Health check
#   - Loads Render Secret Files via start.js
# =============================================================


# =============================================================
# STAGE 1: BUILDER
# Compiles native modules (canvas, sqlite3, bcrypt) with build tools
# =============================================================
FROM node:20-bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=development

# Build tools + canvas dependencies
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

# Copy package manifests first (better layer caching)
COPY package*.json ./

# Install ALL dependencies (dev + prod) so native modules compile.
# Uses npm install (not --production) so postinstall hooks run.
RUN npm install --no-audit --no-fund --prefer-offline \
    && npm cache clean --force


# =============================================================
# STAGE 2: RUNTIME
# Only runtime libs — no compilers — smaller, safer image
# =============================================================
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    TZ=Asia/Dhaka \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8080

# Runtime-only shared libraries (NO compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init \
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

# Create non-root user
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home nodejs

# Copy compiled node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy project files (respects .dockerignore)
COPY --chown=nodejs:nodejs . .

# Create writable runtime folders
RUN mkdir -p /app/backups /app/logs /app/tmp \
    && chown -R nodejs:nodejs /app \
    && chmod +x /app/start.js 2>/dev/null || true

# Volumes for data persistence
VOLUME ["/app/backups", "/app/logs"]

# Switch to non-root
USER nodejs

# Expose HTTP port for Render
EXPOSE 8080

# Health check (start.js boots bot which exposes /health)
HEALTHCHECK --interval=60s \
            --timeout=10s \
            --start-period=60s \
            --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Graceful shutdown — dumb-init forwards SIGTERM to child
STOPSIGNAL SIGTERM

# dumb-init → start.js → Goat.js
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "start.js"]