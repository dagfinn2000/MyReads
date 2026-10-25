import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * A Prisma client for DATABASE_URL, talking to Postgres through the `pg`
 * driver. Connecting gives up after 5 seconds, as Prisma 6 did, rather than
 * waiting forever for a database that isn't there.
 */
export function createPrisma(url = process.env.DATABASE_URL): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5_000 }) });
}

/**
 * Prisma client singleton. Next.js hot-reload re-evaluates modules in dev,
 * which would otherwise spawn a new connection pool on every change — so the
 * instance is stashed on globalThis outside production.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
