import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. Next.js hot-reload re-evaluates modules in dev,
 * which would otherwise spawn a new connection pool on every change — so the
 * instance is stashed on globalThis outside production.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
