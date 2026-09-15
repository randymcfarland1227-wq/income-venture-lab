import { eq } from "drizzle-orm";
import { getReadyDb } from "@/db";
import * as s from "@/db/schema";
import { loadState } from "@/lib/server/repo";
import { callSheets } from "@/lib/server/sheets";
import { buildSummary, readMeta, recentEvents, runSync } from "@/lib/server/sync";
import type { TabKey } from "@/lib/sync/tabs";

export const dynamic = "force-dynamic";

/** Sync activity: recent events plus anything waiting on the user. */
export async function GET() {
  try {
    const db = await getReadyDb();
    const [events, meta, open] = await Promise.all([
      recentEvents(db),
      readMeta(db),
      db.select({ id: s.syncConflicts.id }).from(s.syncConflicts).where(eq(s.syncConflicts.status, "Open")),
    ]);
    return Response.json({ events, summary: buildSummary(meta, open.length), pendingMissing: meta.pendingMissing ?? {} });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not read sync activity." }, { status: 500 });
  }
}

/**
 * `run` reconciles both workbooks now. `acceptMissing` confirms that rows which vanished
 * from the given tabs were removed on purpose. `setup` re-runs the sheet setup routine.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; tabs?: TabKey[] };
    const db = await getReadyDb();
    let setupLog: string[] | undefined;
    if (body.action === "setup") {
      setupLog = (await callSheets<{ log: string[] }>("setup")).log;
    }
    const result = await runSync(db, { acceptMissing: body.action === "acceptMissing" ? body.tabs : undefined });
    return Response.json({ result, setupLog, state: await loadState(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sync failed." }, { status: 500 });
  }
}
