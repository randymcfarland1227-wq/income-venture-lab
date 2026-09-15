import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { runMigrations } from "./migrate";
import { seedIfEmpty, seedInvestmentsIfEmpty } from "@/lib/server/seed";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let ready: Promise<void> | null = null;

export function getDb(): Db {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

/** Database with migrations applied and the first-run snapshot loaded. */
export async function getReadyDb(): Promise<Db> {
  const db = getDb();
  ready ??= (async () => {
    await runMigrations(env.DB as D1Database);
    await seedIfEmpty(db);
    await seedInvestmentsIfEmpty(db);
  })().catch(error => {
    ready = null;
    throw error;
  });
  await ready;
  return db;
}
