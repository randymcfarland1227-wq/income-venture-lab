import { eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Db } from "@/db";
import { SNAPSHOT_GUARDRAILS, SNAPSHOT_TAKEN_AT, snapshotTables } from "@/lib/snapshot";
import { TABS } from "@/lib/sync/tabs";
import { newId, readRow, recordFromRow, type SyncRecord } from "./records";

const TABLE = { idea: s.ideas, experiment: s.experiments, sprintAction: s.sprintActions, milestone: s.milestones, expense: s.expenses } as const;

/**
 * Fills a brand-new database from the snapshot so the Lab is useful before Google access is
 * authorized. Snapshot records get placeholder sync ids; the first live pull links each one
 * to its real row and adopts that row's `_sync_id`.
 */
export async function seedIfEmpty(db: Db) {
  const seeded = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "seeded")).get();
  if (seeded) return;

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
        statements.push(db.insert(TABLE[tab.entity]).values(record as never));
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
}
