import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests for the pure logic in src/lib — no DOM, no database.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
