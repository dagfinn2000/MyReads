import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests for the pure logic in src/lib — no DOM, no database.
    include: ["src/**/*.test.ts"],
    // Database-backed tests need a live Postgres, so they are their own
    // suite (`npm run test:db`, vitest.config.db.ts) and stay out of the
    // fast default run.
    exclude: ["**/node_modules/**", "src/**/*.db.test.ts"],
    environment: "node",
    // The reading-room drawing checks render every house, season and pose
    // and take a few seconds each; on a busy CI runner that brushed the
    // default 5 s limit and failed tests that were right. The limit is
    // there to catch a hang, which this still does.
    testTimeout: 30_000,
  },
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
