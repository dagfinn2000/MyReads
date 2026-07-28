#!/usr/bin/env bash
# Runs a command against a throwaway Postgres.
#
#   scripts/with-test-db.sh npm run test:db
#
# Starts a postgres:16-alpine container on a non-default port, applies the
# migrations, runs the command, then removes the container. The database is
# created fresh each time, so tests never inherit state from a previous run.
#
# If DATABASE_URL is already set, the container is skipped and the command
# runs against whatever it points at — that is how CI uses a service
# container instead.
set -euo pipefail

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[test-db] using existing DATABASE_URL"
  npx prisma migrate deploy >/dev/null
  exec "$@"
fi

CONTAINER="myreads-test-db-$$"
PORT="${TEST_DB_PORT:-55433}"
export DATABASE_URL="postgresql://myreads:testpass@localhost:${PORT}/myreads_test"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[test-db] starting postgres on :${PORT}"
docker run --rm -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_USER=myreads \
  -e POSTGRES_DB=myreads_test \
  -p "${PORT}:5432" \
  postgres:16-alpine >/dev/null

echo "[test-db] waiting for readiness"
until docker exec "$CONTAINER" pg_isready -U myreads -d myreads_test >/dev/null 2>&1; do
  sleep 1
done

echo "[test-db] applying migrations"
npx prisma migrate deploy >/dev/null

echo "[test-db] running: $*"
"$@"
