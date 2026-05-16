// lib/db.ts
// COST: Neon PostgreSQL — $0/month, serverless, scales to zero between requests.
// Sufficient for ~500 employees with 8 goals each = ~4000 goal rows.
// Prisma 7 requires explicit driver adapter for PostgreSQL connections.

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
  // The DATABASE_URL from prisma dev uses prisma+postgres:// protocol
  // We need the direct postgres:// URL for the pg driver
  let connectionString = process.env.DATABASE_URL || "";
  
  // If using Prisma Postgres (prisma+postgres://), extract the actual postgres URL from the API key
  if (connectionString.startsWith("prisma+postgres://")) {
    // Parse the api_key to get the actual database URL
    const url = new URL(connectionString);
    const apiKey = url.searchParams.get("api_key");
    if (apiKey) {
      try {
        const decoded = JSON.parse(Buffer.from(apiKey, "base64").toString());
        connectionString = decoded.databaseUrl || connectionString;
      } catch {
        // Fallback: construct from known local dev defaults
        const host = url.hostname || "localhost";
        const port = parseInt(url.port || "5432") + 1; // prisma dev uses port+1 for direct
        connectionString = `postgres://postgres:postgres@${host}:${port}/template1?sslmode=disable`;
      }
    }
  }

  const pool = new pg.Pool({ connectionString });
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
