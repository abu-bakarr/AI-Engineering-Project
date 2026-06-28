import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error(
    "Prisma database URL is not configured. Set DATABASE_URL or SUPABASE_DB_URL in .env.",
  );
}

const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(databaseUrl, {
      schema: "public",
      onPoolError: (error) => {
        console.error("Unexpected Prisma PostgreSQL pool error:", error);
      },
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
