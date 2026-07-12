# ---------------------------------------------------------------------------
# Bibliotek — multi-stage build
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

# Prisma CLI (with its engines) so the entrypoint can `prisma migrate deploy`
RUN npm install -g --no-audit --no-fund prisma@6

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && \
    mkdir -p /app/data/covers && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
