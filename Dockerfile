# ---------------------------------------------------------------------------
# MyReads — multi-stage build
#   deps    → npm ci with the lockfile
#   builder → prisma generate + next build (standalone output)
#   runner  → minimal Alpine image: standalone server + prisma CLI for
#             running migrations on startup
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# openssl is required by Prisma's linux-musl engines
RUN apk add --no-cache openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy values so build-time page-data collection never trips on missing env;
# nothing here is baked into the bundle (no NEXT_PUBLIC_ vars in this app).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-dummy-secret"
RUN npx prisma generate && npx next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    COVERS_DIR=/app/data/covers

# Prisma CLI (with its engines) so the entrypoint can `prisma migrate deploy`.
#
# Copying node_modules/prisma from the deps stage instead was tried, to avoid
# fetching the CLI twice, and reverted after testing the built image: the CLI
# is not self-contained. node_modules/.bin/prisma is a symlink that COPY
# dereferences, stranding it from the .wasm files it loads relative to its own
# path; and @prisma/config pulls transitive dependencies that live outside
# both `prisma` and `@prisma`. Copying the full closure would break silently
# on any Prisma release that adds a dependency, and only a container run would
# reveal it. Not worth ~50 MB.
RUN npm install -g --no-audit --no-fund prisma@6

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Standalone output deliberately omits public/ — without this copy the PWA
# icons 404 in production and Android silently ignores the manifest.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Housekeeping scripts run by the entrypoint (metadata cache prune) and by
# hand (orphaned cover prune). They resolve @prisma/client out of the
# standalone bundle's node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && \
    mkdir -p /app/data/covers && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
