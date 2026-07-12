#!/bin/sh
# Applies pending Prisma migrations, then starts the standalone Next server.
# docker-compose gates this container on the db healthcheck, so the database
# is reachable by the time we get here; if a migration still fails the
# container exits and `restart: unless-stopped` retries.
set -e

echo "[myreads] applying database migrations…"
prisma migrate deploy --schema /app/prisma/schema.prisma

echo "[myreads] starting server on :${PORT:-3000}"
exec node server.js
