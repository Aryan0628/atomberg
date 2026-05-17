// lib/db.ts
// COST: Neon PostgreSQL — $0/month, serverless, scales to zero between requests.
// Sufficient for ~500 employees with 8 goals each = ~4000 goal rows.
// CONNECTION POOLING: DATABASE_URL must include ?pgbouncer=true in production.
// Without pgbouncer, each serverless invocation opens a new PG connection;
// Neon's shared compute has a 100-connection cap — pgbouncer multiplexes all
// serverless workers through a single pool, preventing exhaustion under load.
// DIRECT_URL (no pgbouncer) is used only for Prisma migrations (npx prisma migrate).
// Prisma 7 requires explicit driver adapter for PostgreSQL connections.

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required but not set");
  }
  const connectionString = process.env.DATABASE_URL;
  // max:1 — each Vercel serverless invocation is a single-threaded process.
  // Default (10) wastes connection slots; Neon shared compute caps at ~100 total.
  // pgbouncer multiplexes all workers, so 1 connection per process is correct.
  const pool = new pg.Pool({ connectionString, max: 1 });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
