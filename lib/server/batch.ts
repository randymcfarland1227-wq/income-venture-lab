import type { Db } from "@/db";

type BatchItems = Parameters<Db["batch"]>[0];

/** Runs drizzle statements through D1's batch API in chunks (one round trip per chunk). */
export async function runBatch(db: Db, statements: unknown[], size = 40) {
  for (let i = 0; i < statements.length; i += size) {
    const chunk = statements.slice(i, i + size);
    if (chunk.length) await db.batch(chunk as unknown as BatchItems);
  }
}
