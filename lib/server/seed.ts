import { and, eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Db } from "@/db";
import { SNAPSHOT_GUARDRAILS, SNAPSHOT_TAKEN_AT, snapshotTables } from "@/lib/snapshot";
import { INVESTMENT_CATALOG } from "@/lib/investments/catalog";
import { TABS } from "@/lib/sync/tabs";
import { blankInvestment, newId, readRow, recordFromRow, type SyncRecord } from "./records";

const TABLE = { idea: s.ideas, experiment: s.experiments, sprintAction: s.sprintActions, milestone: s.milestones, expense: s.expenses } as const;

/**
 * Fills a brand-new database from the snapshot so the Lab is useful before Google access is
 * authorized. Snapshot records get placeholder sync ids; the first live pull links each one
 * to its real row and adopts that row's `_sync_id`.
 */
export async function seedIfEmpty(db: Db) {
  const seeded = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "seeded")).get();
  if (seeded) return;

  // Different Worker isolates can receive the first few page requests together.
  // Claim seeding in D1 so only one of them inserts the snapshot.
  const claim = `${Date.now()}:${newId()}`;
  const won = await db.insert(s.appMeta).values({ key: "seeding", value: claim })
    .onConflictDoNothing().returning({ value: s.appMeta.value });
  if (!won.length) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const finished = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "seeded")).get();
      if (finished) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("The lab is still preparing its data. Please reload in a moment.");
  }

  try {
    const existing = await db.select({ n: sql<number>`count(*)` }).from(s.ideas).get();
    if (!existing || existing.n === 0) {
      const ideas: SyncRecord[] = [];
      const statements = [];

      for (const table of snapshotTables()) {
        const tab = TABS[table.tab];
        table.rows.forEach((row, index) => {
          const { values } = readRow(tab, row);
          const record = recordFromRow(
            table.tab,
            values,
            { row: index + 1, sheetName: tab.label, syncId: `snapshot-${newId()}`, source: "snapshot", importedAt: SNAPSHOT_TAKEN_AT },
            ideas,
          );
          record.createdAt = SNAPSHOT_TAKEN_AT;
          record.updatedAt = SNAPSHOT_TAKEN_AT;
          if (tab.entity === "idea") ideas.push(record);
          const entity = tab.entity as keyof typeof TABLE;
          statements.push(db.insert(TABLE[entity]).values(record as never));
        });
      }

      for (const [key, value] of Object.entries(SNAPSHOT_GUARDRAILS)) {
        statements.push(db.insert(s.guardrails).values({ key, value, updatedAt: SNAPSHOT_TAKEN_AT }));
      }
      statements.push(db.insert(s.history).values({
        id: newId(), ideaId: null, entityType: "system", entityId: "snapshot", kind: "imported",
        summary: `Loaded ${ideas.length} opportunities from the workbook snapshot`, at: new Date().toISOString(),
      }));

      for (let i = 0; i < statements.length; i += 40) {
        const chunk = statements.slice(i, i + 40);
        await db.batch(chunk as [typeof chunk[number], ...typeof chunk]);
      }
    }

    await db.insert(s.appMeta).values({ key: "seeded", value: new Date().toISOString() }).onConflictDoNothing();
  } finally {
    await db.delete(s.appMeta).where(and(eq(s.appMeta.key, "seeding"), eq(s.appMeta.value, claim)));
  }
}

export async function seedInvestmentsIfEmpty(db: Db) {
  const marker = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "investments_seed_v1")).get();
  if (marker) return;
  const existing = await db.select({ n: sql<number>`count(*)` }).from(s.investmentOptions).get();
  if (!existing?.n) {
    const records = INVESTMENT_CATALOG.map(item => {
      const { risk: _risk, ...values } = item;
      void _risk;
      return blankInvestment({
        ...values,
        id: item.id,
        syncId: item.id,
        benchmark: item.benchmark ?? "",
        riskProfile: item.riskProfile,
        source: "catalog",
      });
    });
    for (let i = 0; i < records.length; i += 30) {
      const chunk = records.slice(i, i + 30).map(record => db.insert(s.investmentOptions).values(record));
      await db.batch(chunk as [typeof chunk[number], ...typeof chunk]);
    }
  }
  await db.insert(s.appMeta).values({ key: "investments_seed_v1", value: new Date().toISOString() }).onConflictDoNothing();
}
