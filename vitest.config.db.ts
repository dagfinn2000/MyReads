import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Database-backed tests (`npm run test:db`).
 *
 * These exercise the code that talks to Postgres — the restore/export
 * round-trip, ownership checks, the read-history bookkeeping — against a real
 * database rather than a stand-in, because the bugs worth catching there are
 * exactly the ones a fake would reproduce faithfully and wrongly (constraint
 * violations, cascade behaviour, SQL semantics).
 *
 * Requires DATABASE_URL pointing at a database you don't mind being written
 * to; scripts/with-test-db.sh will spin one up in Docker if you have no
 * Postgres to hand. Kept out of the default `npm test` so that stays fast and
 * dependency-free.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.db.test.ts"],
    environment: "node",
    // These share one database; running files in parallel would let one
    // suite's cleanup delete another's fixtures mid-test.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
