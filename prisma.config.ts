import type { PrismaConfig } from "prisma/config";

/**
 * Where the prisma command-line tool finds the schema, the migrations and
 * the database. The app itself connects in src/lib/prisma.ts.
 *
 * Prisma no longer reads .env by itself. Outside Docker, DATABASE_URL lives
 * in .env; in Docker it comes from docker-compose and there is no file. A
 * variable already set wins over the file.
 *
 * A plain object rather than defineConfig(), so the Docker image's own copy
 * of the tool can read this file without the prisma package next to it.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env: the environment has it, or nothing needs a database.
}

export default {
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
} satisfies PrismaConfig;
