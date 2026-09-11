# =============================================================
# Maruf Bot - Production Dockerfile
# Based on Goat Bot V2 by NTKhang03 (MIT License)
# =============================================================

# ---------- Stage 1: Builder ----------
FROM node:20-bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

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

COPY package*.json ./

RUN npm install --no-audit --no-fund --prefer-offline \
    && npm cache clean --force


# ---------- Stage 2: Runtime ----------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    TZ=Asia/Dhaka \
    DEBIAN_FRONTEND=noninteractive

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

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home nodejs

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

RUN mkdir -p /app/backups /app/logs \
    && chown -R nodejs:nodejs /app

VOLUME ["/app/backups", "/app/logs"]

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "Goat.js"]