import { desc, eq, inArray, lt } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Db } from "@/db";
import { includesLong, includesShort, normalizeTitle, type SyncHealth, type SyncSummary } from "@/lib/domain";
import { GUARDRAILS, TABS, WORKBOOKS, type FieldMap, type SyncedEntity, type TabKey } from "@/lib/sync/tabs";
import { normalize, parseSheetValue } from "@/lib/sync/values";
import {
  callSheets, sheetsConfig, SheetsAuthError,
  type GuardrailWrite, type PulledGuardrails, type PulledTab, type PullResponse, type WriteOp, type WriteResponse,
} from "./sheets";
import { runBatch } from "./batch";
import { compareForm, newId, now, rawCompareForm, readRow, recordFromRow, resolveIdeaId, sheetValueOf, type SyncRecord } from "./records";

const TABLE = {
  idea: s.ideas, experiment: s.experiments, sprintAction: s.sprintActions, milestone: s.milestones, expense: s.expenses,
  investment: s.investmentOptions, investmentExperiment: s.investmentExperiments,
} as const;
const ENTITIES = Object.keys(TABLE) as SyncedEntity[];

// Ideas are reconciled twice so a change pulled from one workbook reaches the other in the same run.
const PASSES: TabKey[] = ["shortIdeas", "longIdeas", "shortIdeas", "experiments", "sprint", "plan", "costs", "investments", "investmentExperiments"];

type Baseline = typeof s.syncBaselines.$inferSelect;
type Conflict = typeof s.syncConflicts.$inferInsert;
type EventRow = typeof s.syncEvents.$inferInsert;
type HistoryRow = typeof s.history.$inferInsert;
type Pending = { tab: TabKey; entity: SyncedEntity; rec: SyncRecord; newBase: Record<string, string>; oldBase: Record<string, string>; row?: number };

export type SyncMeta = {
  health?: SyncHealth;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  sheets?: SyncSummary["sheets"];
  pendingMissing?: Partial<Record<TabKey, number>>;
};

export type RunOptions = { acceptMissing?: TabKey[] };
export type RunResult = { ok: boolean; skipped?: boolean; error?: string; fromSheet: number; toSheet: number; conflicts: number };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runSync(db: Db, options: RunOptions = {}): Promise<RunResult> {
  const empty = { fromSheet: 0, toSheet: 0, conflicts: 0 };
  if (!sheetsConfig().configured) {
    await saveMeta(db, { health: "not_configured" });
    return { ok: false, error: "not_configured", ...empty };
  }
  if (!(await acquireLock(db))) return { ok: true, skipped: true, ...empty };

  const started = now();
  try {
    const pulled = await callSheets<PullResponse>("pull");
    const run = await SyncRun.load(db, options);
    for (const key of PASSES) run.reconcileTab(key, pulled.tabs.find(t => t.key === key));
    run.reconcileGuardrails(pulled.guardrails);
    await run.push();
    await run.persist();

    const openConflicts = await db.select({ id: s.syncConflicts.id }).from(s.syncConflicts).where(eq(s.syncConflicts.status, "Open"));
    const health: SyncHealth = run.issues.length ? "issue" : openConflicts.length ? "conflict" : "synced";
    await saveMeta(db, {
      health, lastRunAt: started, lastSuccessAt: started, lastError: run.issues[0] ?? null,
      sheets: run.sheets, pendingMissing: run.pendingMissing,
    });
    return { ok: true, fromSheet: run.counts.fromSheet, toSheet: run.counts.toSheet, conflicts: run.counts.conflicts };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const health: SyncHealth = error instanceof SheetsAuthError ? "needs_authorization" : "issue";
    const meta = await readMeta(db);
    if (meta.lastError !== message) {
      await db.insert(s.syncEvents).values(event("system", "", "", "", "sync", "issue", message));
    }
    await saveMeta(db, { health, lastRunAt: started, lastError: message });
    return { ok: false, error: message, ...empty };
  } finally {
    await releaseLock(db);
  }
}

export async function readMeta(db: Db): Promise<SyncMeta> {
  const row = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "sync")).get();
  return (row?.value as SyncMeta) ?? {};
}

export function buildSummary(meta: SyncMeta, openConflicts: number): SyncSummary {
  const cfg = sheetsConfig();
  let health: SyncHealth = meta.health ?? "syncing";
  if (!cfg.configured) health = "not_configured";
  else if (health !== "needs_authorization" && health !== "issue" && openConflicts > 0) health = "conflict";
  else if (health === "conflict" && openConflicts === 0) health = "synced";
  return {
    configured: cfg.configured,
    health,
    lastRunAt: meta.lastRunAt ?? null,
    lastSuccessAt: meta.lastSuccessAt ?? null,
    lastError: meta.lastError ?? null,
    openConflicts,
    editorUrl: cfg.editorUrl,
    sheets: meta.sheets ?? {},
  };
}

export async function recentEvents(db: Db, limit = 150) {
  return db.select().from(s.syncEvents).orderBy(desc(s.syncEvents.at)).limit(limit);
}

// ---------------------------------------------------------------------------
// One reconciliation run
// ---------------------------------------------------------------------------

class SyncRun {
  readonly at = now();
  readonly records = new Map<SyncedEntity, Map<string, SyncRecord>>();
  readonly bySync = new Map<SyncedEntity, Map<string, SyncRecord>>();
  readonly inserted = new Set<string>();
  readonly dirty = new Set<string>();
  readonly baselineWrites = new Map<string, Baseline>();
  readonly baselineDeletes = new Set<string>();
  readonly newConflicts: Conflict[] = [];
  readonly resolvedConflicts: string[] = [];
  readonly ops = new Map<string, WriteOp>();
  readonly pending = new Map<string, Pending>();
  readonly events: EventRow[] = [];
  readonly historyRows: HistoryRow[] = [];
  readonly adopted = new Set<string>();
  readonly issues: string[] = [];
  readonly counts = { fromSheet: 0, toSheet: 0, conflicts: 0 };
  readonly sheets: SyncSummary["sheets"] = {};
  readonly pendingMissing: Partial<Record<TabKey, number>> = {};
  readonly guardrailDirty = new Set<string>();
  guardrailPush: GuardrailWrite | null = null;
  guardrailBase: Record<string, string> = {};

  private constructor(
    private readonly db: Db,
    private readonly options: RunOptions,
    readonly baselines: Map<string, Baseline>,
    readonly openConflicts: Map<string, typeof s.syncConflicts.$inferSelect>,
    readonly ideasWithContent: Set<string>,
    readonly guardrails: Map<string, string | number | null>,
  ) {}

  static async load(db: Db, options: RunOptions) {
    const [ideas, experiments, sprint, milestones, expenses, investments, investmentExperiments, baselines, conflicts, guardrails, research, competitors, assumptions, barriers, financials, findings] =
      await db.batch([
        db.select().from(s.ideas),
        db.select().from(s.experiments),
        db.select().from(s.sprintActions),
        db.select().from(s.milestones),
        db.select().from(s.expenses),
        db.select().from(s.investmentOptions),
        db.select().from(s.investmentExperiments),
        db.select().from(s.syncBaselines),
        db.select().from(s.syncConflicts).where(eq(s.syncConflicts.status, "Open")),
        db.select().from(s.guardrails),
        db.select({ ideaId: s.research.ideaId }).from(s.research),
        db.select({ ideaId: s.competitors.ideaId }).from(s.competitors),
        db.select({ ideaId: s.assumptions.ideaId }).from(s.assumptions),
        db.select({ ideaId: s.barriers.ideaId }).from(s.barriers),
        db.select({ ideaId: s.financialModels.ideaId }).from(s.financialModels),
        db.select({ ideaId: s.findings.ideaId }).from(s.findings),
      ]);

    const withContent = new Set<string>();
    for (const rows of [research, competitors, assumptions, barriers, financials, findings, experiments, milestones, expenses]) {
      for (const r of rows as Array<{ ideaId: string | null }>) if (r.ideaId) withContent.add(r.ideaId);
    }

    const run = new SyncRun(
      db, options,
      new Map(baselines.map(b => [b.id, b])),
      new Map(conflicts.map(c => [`${c.tab}:${c.syncId}:${c.field}`, c])),
      withContent,
      new Map(guardrails.map(g => [g.key, g.value ?? null])),
    );
    const all: Record<SyncedEntity, SyncRecord[]> = {
      idea: ideas as unknown as SyncRecord[], experiment: experiments as unknown as SyncRecord[],
      sprintAction: sprint as unknown as SyncRecord[], milestone: milestones as unknown as SyncRecord[],
      expense: expenses as unknown as SyncRecord[], investment: investments as unknown as SyncRecord[],
      investmentExperiment: investmentExperiments as unknown as SyncRecord[],
    };
    const investmentById = new Map(investments.map(i => [i.id, i]));
    for (const experiment of all.investmentExperiment) {
      const linked = typeof experiment.investmentId === "string" ? investmentById.get(experiment.investmentId) : undefined;
      experiment.investmentSyncId = linked?.syncId ?? "";
    }
    for (const entity of ENTITIES) {
      run.records.set(entity, new Map(all[entity].map(r => [r.id, r])));
      run.bySync.set(entity, new Map(all[entity].map(r => [r.syncId, r])));
    }
    return run;
  }

  // ----- membership ------------------------------------------------------

  private idea(id: unknown) {
    return typeof id === "string" ? this.records.get("idea")?.get(id) : undefined;
  }

  private includes(tabKey: TabKey, rec: SyncRecord) {
    const horizon = String(rec.horizon ?? "");
    switch (tabKey) {
      case "shortIdeas": return includesShort(horizon);
      case "longIdeas": return includesLong(horizon);
      case "sprint": return true;
      case "experiments": {
        const idea = this.idea(rec.ideaId);
        return !idea || !!idea.deletedAt || includesShort(String(idea.horizon));
      }
      case "plan":
      case "costs": {
        const idea = this.idea(rec.ideaId);
        return !idea || !!idea.deletedAt || includesLong(String(idea.horizon));
      }
      case "investments":
      case "investmentExperiments": return true;
    }
  }

  private hasContent(entity: SyncedEntity, rec: SyncRecord) {
    if (rec.updatedAt !== rec.createdAt) return true;
    return entity === "idea" && this.ideasWithContent.has(rec.id);
  }

  // ----- bookkeeping -----------------------------------------------------

  private touch(entity: SyncedEntity, rec: SyncRecord) {
    rec.updatedAt = this.at;
    this.dirty.add(`${entity}:${rec.id}`);
  }

  private setBaseline(tabKey: TabKey, entity: SyncedEntity, rec: SyncRecord, values: Record<string, string>, row?: number) {
    const id = `${tabKey}:${rec.syncId}`;
    const baseline: Baseline = {
      id, tab: tabKey, syncId: rec.syncId, entityType: entity, entityId: rec.id, values,
      row: row ?? this.baselines.get(id)?.row ?? null, syncedAt: this.at,
    };
    this.baselines.set(id, baseline);
    this.baselineWrites.set(id, baseline);
    this.baselineDeletes.delete(id);
  }

  private dropBaseline(tabKey: TabKey, syncId: string) {
    const id = `${tabKey}:${syncId}`;
    this.baselines.delete(id);
    this.baselineWrites.delete(id);
    this.baselineDeletes.add(id);
  }

  private log(direction: string, tabKey: string, entity: string, syncId: string, action: string, status: string, details: string) {
    this.events.push(event(direction, tabKey, entity, syncId, action, status, details));
  }

  private historyFor(entity: SyncedEntity, rec: SyncRecord, kind: string, summary: string) {
    const ideaId = entity === "idea" ? rec.id : typeof rec.ideaId === "string" ? rec.ideaId : null;
    this.historyRows.push({ id: newId(), ideaId, entityType: entity, entityId: rec.id, kind, summary, at: this.at });
  }

  private addConflict(tabKey: TabKey, entity: SyncedEntity, rec: SyncRecord, field: FieldMap, siteValue: string, sheetValue: string, baseValue: string) {
    const key = `${tabKey}:${rec.syncId}:${field.field}`;
    if (this.openConflicts.has(key)) return;
    const conflict = {
      id: newId(), tab: tabKey, entityType: entity, entityId: rec.id, syncId: rec.syncId, field: field.field,
      header: field.header, label: field.label, title: titleOf(entity, rec), siteValue, sheetValue, baseValue,
      status: "Open", resolution: null, createdAt: this.at, resolvedAt: null,
    };
    this.openConflicts.set(key, conflict);
    this.newConflicts.push(conflict);
    this.counts.conflicts++;
    this.log("both", tabKey, entity, rec.syncId, "conflict", "conflict",
      `${field.label} changed in both places on "${titleOf(entity, rec)}" — site: ${siteValue || "blank"}, sheet: ${sheetValue || "blank"}`);
  }

  private queueUpsert(tabKey: TabKey, entity: SyncedEntity, rec: SyncRecord, values: Record<string, unknown>, expect: Record<string, string> | undefined, newBase: Record<string, string>, oldBase: Record<string, string>, row?: number, restore = false) {
    const key = `${tabKey}:${rec.syncId}`;
    const prev = this.ops.get(key);
    this.ops.set(key, {
      tab: tabKey, op: "upsert", syncId: rec.syncId,
      values: { ...(prev?.values ?? {}), ...values },
      expect: expect || prev?.expect ? { ...(prev?.expect ?? {}), ...(expect ?? {}) } : undefined,
      restore: Boolean(prev?.restore || restore),
    });
    const prevPending = this.pending.get(key);
    this.pending.set(key, { tab: tabKey, entity, rec, newBase: { ...(prevPending?.newBase ?? {}), ...newBase }, oldBase, row });
  }

  private queueDelete(tabKey: TabKey, syncId: string, reason: string) {
    this.ops.set(`${tabKey}:${syncId}`, { tab: tabKey, op: "markDeleted", syncId, reason });
  }

  // ----- reconciliation ----------------------------------------------------

  reconcileTab(tabKey: TabKey, pulled: PulledTab | undefined) {
    const tab = TABS[tabKey];
    const entity = tab.entity;
    if (!pulled?.found || !pulled.rows || !pulled.headers) {
      if (!this.issues.some(i => i.startsWith(tab.label))) {
        this.log("system", tabKey, entity, "", "locate", "issue", `${tab.label} tab was not found in the ${WORKBOOKS[tab.workbook].short}; skipped.`);
      }
      return;
    }
    this.sheets[tabKey] = { sheetName: pulled.sheetName ?? tab.label, gid: pulled.gid ?? 0 };

    const headers = new Set(pulled.headers);
    const formulas = new Set(pulled.formulaHeaders ?? []);
    const present = tab.fields.filter(f => headers.has(f.header));
    const writable = present.filter(f => f.authority !== "appToSheet" && !f.readOnly && !formulas.has(f.header));
    const calculated = present.filter(f => f.authority !== "appToSheet" && (f.readOnly || formulas.has(f.header)));
    const authoritative = present.filter(f => f.authority === "appToSheet");
    const records = this.records.get(entity) as Map<string, SyncRecord>;
    const bySync = this.bySync.get(entity) as Map<string, SyncRecord>;
    const seen = new Set<string>();

    for (const row of pulled.rows) {
      if (!row.syncId) continue;
      const { values: typed, invalid } = readRow(tab, row.values);

      if (seen.has(row.syncId)) {
        // A copied row brought its original's identity along — give it a new one.
        if (row.deleted) continue;
        const fresh = newId();
        this.ops.set(`${tabKey}:reassign:${row.row}`, { tab: tabKey, op: "reassign", syncId: row.syncId, row: row.row, newSyncId: fresh });
        const links = entity === "investmentExperiment" ? this.records.get("investment")?.values() : this.records.get("idea")?.values();
        const rec = recordFromRow(tabKey, typed, { row: row.row, sheetName: pulled.sheetName ?? tab.label, syncId: fresh }, links ?? []);
        this.insert(entity, rec);
        seen.add(fresh);
        this.setBaseline(tabKey, entity, rec, this.baseFrom(writable, typed), row.row);
        this.historyFor(entity, rec, "imported", `Added from ${pulled.sheetName} (copied row)`);
        this.log("sheet→site", tabKey, entity, fresh, "created", "ok", `New row "${titleOf(entity, rec)}" (copy of another row) added from ${pulled.sheetName}`);
        this.counts.fromSheet++;
        continue;
      }
      seen.add(row.syncId);

      let rec = bySync.get(row.syncId);
      const base = this.baselines.get(`${tabKey}:${row.syncId}`);

      if (!rec) {
        if (row.deleted) continue;
        const adopt = this.findAdoptable(tabKey, typed);
        if (adopt) {
          bySync.delete(adopt.syncId);
          adopt.syncId = row.syncId;
          adopt.source = "sheet";
          bySync.set(adopt.syncId, adopt);
          this.adopted.add(adopt.id);
          // An adopted starter row may absorb user-entered fields and legacy
          // sheet formulas, but never source-derived/application-owned facts.
          for (const f of present.filter(field => field.authority !== "appToSheet")) {
            if (!invalid.has(f.field)) adopt[f.field] = typed[f.field];
          }
          Object.assign(adopt, { sourceSheet: pulled.sheetName ?? tab.label, sourceRow: row.row });
          this.dirty.add(`${entity}:${adopt.id}`);
          this.setBaseline(tabKey, entity, adopt, this.baseFrom(writable, typed), row.row);
          continue;
        }
        const links = entity === "investmentExperiment" ? this.records.get("investment")?.values() : this.records.get("idea")?.values();
        rec = recordFromRow(tabKey, typed, { row: row.row, sheetName: pulled.sheetName ?? tab.label, syncId: row.syncId }, links ?? []);
        this.insert(entity, rec);
        this.setBaseline(tabKey, entity, rec, this.baseFrom(writable, typed), row.row);
        this.historyFor(entity, rec, "imported", `Added from ${WORKBOOKS[tab.workbook].short} · ${pulled.sheetName}`);
        this.log("sheet→site", tabKey, entity, row.syncId, "created", "ok", `New row "${titleOf(entity, rec)}" added from ${pulled.sheetName}`);
        this.counts.fromSheet++;
        continue;
      }

      if (rec.deletedAt) {
        // Site deletion wins; the tombstone keeps the row from resurrecting the record.
        if (!row.deleted) {
          this.queueDelete(tabKey, rec.syncId, "site-deleted");
          this.log("site→sheet", tabKey, entity, rec.syncId, "deleted", "ok", `Archived "${titleOf(entity, rec)}" in ${pulled.sheetName}`);
          this.counts.toSheet++;
        }
        this.dropBaseline(tabKey, rec.syncId);
        continue;
      }

      const included = this.includes(tabKey, rec);

      if (row.deleted) {
        if (base) {
          this.sheetRemoved(tabKey, entity, rec, `archived in ${pulled.sheetName}`);
          this.dropBaseline(tabKey, rec.syncId);
        } else if (included) {
          // The site restored this record (or moved it back to this horizon).
          const values = Object.fromEntries([...writable, ...authoritative].map(f => [f.header, sheetValueOf(f, rec as SyncRecord)]));
          this.queueUpsert(tabKey, entity, rec, values, undefined, this.baseFrom(writable, rec), {}, row.row, true);
          this.log("site→sheet", tabKey, entity, rec.syncId, "restored", "ok", `Restored "${titleOf(entity, rec)}" in ${pulled.sheetName}`);
          this.counts.toSheet++;
        }
        continue;
      }

      if (!included) {
        this.queueDelete(tabKey, rec.syncId, "moved");
        this.dropBaseline(tabKey, rec.syncId);
        this.log("site→sheet", tabKey, entity, rec.syncId, "moved", "ok", `"${titleOf(entity, rec)}" no longer belongs in ${pulled.sheetName}; row archived`);
        continue;
      }

      // Calculated columns always come from the sheet.
      for (const f of calculated) {
        if (invalid.has(f.field)) continue;
        if (normalize(rec[f.field]) !== normalize(typed[f.field])) {
          rec[f.field] = typed[f.field];
          this.dirty.add(`${entity}:${rec.id}`);
        }
      }

      const oldBase = base?.values ?? {};
      const newBase: Record<string, string> = { ...oldBase };
      const push: Record<string, unknown> = {};
      const expect: Record<string, string> = {};
      const fromSheet: FieldMap[] = [];

      // Verified source values and application calculations always flow out to
      // Sheets. A hand edit in one of these columns is intentionally replaced.
      for (const f of authoritative) {
        const site = compareForm(f, rec);
        // `typed` already contains the parsed cell under the mapped field.
        // Do not run virtual application fields (such as risk profile facets)
        // through `sheetValueOf`, which reads from the structured site record.
        const sheet = normalize(typed[f.field]);
        if (site !== sheet) push[f.header] = sheetValueOf(f, rec);
      }

      for (const f of writable) {
        if (invalid.has(f.field)) continue;
        const site = compareForm(f, rec);
        const sheet = compareForm(f, typed);
        const origin = oldBase[f.header];
        const open = this.openConflicts.get(`${tabKey}:${rec.syncId}:${f.field}`);

        if (site === sheet) {
          newBase[f.header] = site;
          if (open) this.resolvedConflicts.push(open.id);
          continue;
        }
        if (open) continue;

        if (origin === undefined) {
          if (!sheet) {
            push[f.header] = sheetValueOf(f, rec);
            expect[f.header] = normalize(row.values[f.header]);
            newBase[f.header] = site;
          } else if (!site) {
            rec[f.field] = typed[f.field];
            fromSheet.push(f);
            newBase[f.header] = sheet;
          } else {
            this.addConflict(tabKey, entity, rec, f, site, sheet, "");
          }
        } else if (sheet === origin) {
          push[f.header] = sheetValueOf(f, rec);
          expect[f.header] = normalize(row.values[f.header]);
          newBase[f.header] = site;
        } else if (site === origin) {
          rec[f.field] = typed[f.field];
          fromSheet.push(f);
          newBase[f.header] = sheet;
        } else {
          this.addConflict(tabKey, entity, rec, f, site, sheet, origin);
        }
      }

      if (fromSheet.length) this.appliedFromSheet(tabKey, entity, rec, fromSheet, pulled.sheetName ?? tab.label);

      if (Object.keys(push).length) {
        this.queueUpsert(tabKey, entity, rec, push, expect, newBase, oldBase, row.row);
      } else if (!base || JSON.stringify(newBase) !== JSON.stringify(oldBase) || base.row !== row.row) {
        this.setBaseline(tabKey, entity, rec, newBase, row.row);
      }
    }

    // Records that belong in this tab but have no row.
    const missing: SyncRecord[] = [];
    for (const rec of records.values()) {
      if (rec.deletedAt || seen.has(rec.syncId) || !this.includes(tabKey, rec)) continue;
      if (this.baselines.has(`${tabKey}:${rec.syncId}`)) {
        missing.push(rec);
        continue;
      }
      if (rec.source === "snapshot" && !this.adopted.has(rec.id)) {
        if (!pulled.rows.length) continue;
        if (!this.hasContent(entity, rec)) {
          rec.deletedAt = this.at;
          this.touch(entity, rec);
          this.log("system", tabKey, entity, rec.syncId, "retired", "ok", `Snapshot record "${titleOf(entity, rec)}" has no matching row in ${pulled.sheetName}; retired`);
          continue;
        }
        rec.source = "site";
      }
      const values = Object.fromEntries([...writable, ...authoritative].map(f => [f.header, sheetValueOf(f, rec)]));
      this.queueUpsert(tabKey, entity, rec, values, undefined, this.baseFrom(writable, rec), {});
    }

    if (missing.length) {
      const tracked = [...this.baselines.values()].filter(b => b.tab === tabKey).length;
      const safe = this.options.acceptMissing?.includes(tabKey)
        || (pulled.rows.length > 0 && missing.length <= Math.max(2, Math.floor(tracked * 0.25)));
      if (!safe) {
        this.pendingMissing[tabKey] = missing.length;
        const note = `${missing.length} row${missing.length === 1 ? "" : "s"} disappeared from ${pulled.sheetName}. Nothing was deleted — confirm in Sync Activity if the removal was intentional.`;
        this.issues.push(`${tab.label}: ${note}`);
        this.log("system", tabKey, entity, "", "missing", "issue", note);
      } else {
        for (const rec of missing) {
          this.sheetRemoved(tabKey, entity, rec, `row removed from ${pulled.sheetName}`);
          this.dropBaseline(tabKey, rec.syncId);
        }
      }
    }
  }

  private baseFrom(fields: FieldMap[], values: Record<string, unknown>) {
    return Object.fromEntries(fields.map(f => [f.header, compareForm(f, values)]));
  }

  private insert(entity: SyncedEntity, rec: SyncRecord) {
    this.records.get(entity)?.set(rec.id, rec);
    this.bySync.get(entity)?.set(rec.syncId, rec);
    this.inserted.add(`${entity}:${rec.id}`);
  }

  private findAdoptable(tabKey: TabKey, typed: Record<string, unknown>) {
    const tab = TABS[tabKey];
    const records = this.records.get(tab.entity) as Map<string, SyncRecord>;
    const candidates = [...records.values()].filter(r =>
      r.source === "snapshot" && !r.deletedAt && !this.adopted.has(r.id)
      && !this.baselines.has(`${tabKey}:${r.syncId}`) && this.includes(tabKey, r));
    if (tabKey === "shortIdeas" && typeof typed.sheetRef === "number") {
      const byRef = candidates.find(r => r.sheetRef === typed.sheetRef);
      if (byRef) return byRef;
    }
    const title = normalizeTitle(String(typed[tab.titleField] ?? ""));
    if (!title) return undefined;
    return candidates.find(r => normalizeTitle(String(r[tab.titleField] ?? "")) === title);
  }

  private sheetRemoved(tabKey: TabKey, entity: SyncedEntity, rec: SyncRecord, why: string) {
    if (entity === "idea" && rec.horizon === "Both") {
      rec.horizon = tabKey === "shortIdeas" ? "Long Term" : "Short Term";
      this.touch(entity, rec);
      this.historyFor(entity, rec, "horizon", `Horizon changed to ${rec.horizon} (${why})`);
      this.log("sheet→site", tabKey, entity, rec.syncId, "updated", "ok", `"${titleOf(entity, rec)}" now ${rec.horizon} — ${why}`);
    } else {
      rec.deletedAt = this.at;
      this.touch(entity, rec);
      this.historyFor(entity, rec, "deleted", `Archived — ${why}`);
      this.log("sheet→site", tabKey, entity, rec.syncId, "deleted", "ok", `Archived "${titleOf(entity, rec)}" — ${why}`);
    }
    this.counts.fromSheet++;
  }

  private appliedFromSheet(tabKey: TabKey, entity: SyncedEntity, rec: SyncRecord, fields: FieldMap[], sheetName: string) {
    this.touch(entity, rec);
    if (fields.some(f => f.field === "ideaLabel")) {
      const linked = resolveIdeaId(String(rec.ideaLabel ?? ""), this.records.get("idea")?.values() ?? []);
      if (linked) rec.ideaId = linked;
    }
    if (fields.some(f => f.field === "investmentLabel")) {
      const wanted = normalizeTitle(String(rec.investmentLabel ?? ""));
      const linked = [...(this.records.get("investment")?.values() ?? [])]
        .find(option => normalizeTitle(String(option.name ?? "")) === wanted);
      if (linked) {
        rec.investmentId = linked.id;
        rec.investmentSyncId = linked.syncId;
      }
    }
    for (const f of fields) {
      if (entity === "idea" && (f.field === "status" || f.field === "title")) {
        this.historyFor(entity, rec, f.field, `${f.label} changed to "${rec[f.field]}" in ${sheetName}`);
      }
    }
    this.log("sheet→site", tabKey, entity, rec.syncId, "updated", "ok",
      `${fields.map(f => f.label).join(", ")} updated on "${titleOf(entity, rec)}" from ${sheetName}`);
    this.counts.fromSheet++;
  }

  reconcileGuardrails(pulled: PulledGuardrails | undefined) {
    if (!pulled?.found || !pulled.values) return;
    this.sheets.guardrails = { sheetName: pulled.sheetName ?? "Start Here", gid: pulled.gid ?? 0 };
    const push: GuardrailWrite = { values: {}, expect: {} };
    const base = this.baselines.get("guardrails:all")?.values ?? {};
    const next: Record<string, string> = { ...base };

    for (const def of GUARDRAILS) {
      if (!(def.key in pulled.values)) continue;
      const parsed = parseSheetValue(pulled.values[def.key], def.type);
      if (!parsed.ok) continue;
      const sheet = normalize(parsed.value);
      const site = normalize(this.guardrails.get(def.key) ?? null);
      const origin = base[def.key];
      const open = this.openConflicts.get(`guardrails:guardrails:${def.key}`);

      if (site === sheet) {
        next[def.key] = site;
        if (open) this.resolvedConflicts.push(open.id);
        continue;
      }
      if (open) continue;
      const sheetWins = (origin === undefined && !site) || (origin !== undefined && site === origin);
      const siteWins = (origin === undefined && !sheet) || (origin !== undefined && sheet === origin);
      if (sheetWins) {
        this.guardrails.set(def.key, parsed.value);
        this.guardrailDirty.add(def.key);
        next[def.key] = sheet;
        this.log("sheet→site", "guardrails", "guardrail", def.key, "updated", "ok", `${def.label} updated from ${pulled.sheetName}`);
        this.counts.fromSheet++;
      } else if (siteWins) {
        push.values[def.key] = this.guardrails.get(def.key) ?? "";
        push.expect[def.key] = normalize(pulled.values[def.key]);
        next[def.key] = site;
      } else {
        const key = `guardrails:guardrails:${def.key}`;
        const conflict = {
          id: newId(), tab: "guardrails", entityType: "guardrail", entityId: def.key, syncId: "guardrails",
          field: def.key, header: def.key, label: def.label, title: "Guardrails", siteValue: site, sheetValue: sheet,
          baseValue: origin ?? "", status: "Open", resolution: null, createdAt: this.at, resolvedAt: null,
        };
        this.openConflicts.set(key, conflict);
        this.newConflicts.push(conflict);
        this.counts.conflicts++;
        this.log("both", "guardrails", "guardrail", def.key, "conflict", "conflict",
          `${def.label} changed in both places — site: ${site || "blank"}, sheet: ${sheet || "blank"}`);
      }
    }
    this.guardrailBase = next;
    if (Object.keys(push.values).length) this.guardrailPush = push;
    else if (JSON.stringify(next) !== JSON.stringify(base)) this.writeGuardrailBaseline(next);
  }

  private writeGuardrailBaseline(values: Record<string, string>) {
    const baseline: Baseline = {
      id: "guardrails:all", tab: "guardrails", syncId: "guardrails", entityType: "guardrail",
      entityId: "guardrails", values, row: null, syncedAt: this.at,
    };
    this.baselines.set(baseline.id, baseline);
    this.baselineWrites.set(baseline.id, baseline);
  }

  // ----- write-back --------------------------------------------------------

  async push() {
    const ops = [...this.ops.values()];
    if (!ops.length && !this.guardrailPush) return;
    const response = await callSheets<WriteResponse>("write", { ops, guardrails: this.guardrailPush });

    for (const result of response.results) {
      const tab = TABS[result.tab];
      if (!result.ok) {
        if (result.op === "reassign") {
          // The copied row moved before it could be re-identified; drop the site copy and retry next sync.
          const op = [...this.ops.values()].find(o => o.op === "reassign" && o.tab === result.tab && o.syncId === result.syncId);
          const copy = op?.newSyncId && tab ? this.bySync.get(tab.entity)?.get(op.newSyncId) : undefined;
          if (copy && tab) {
            copy.deletedAt = this.at;
            this.dirty.add(`${tab.entity}:${copy.id}`);
            this.dropBaseline(result.tab, copy.syncId);
          }
          continue;
        }
        const message = `${tab?.label ?? result.tab}: ${result.error}`;
        this.issues.push(message);
        this.log("site→sheet", result.tab, tab?.entity ?? "", result.syncId, result.op, "issue", message);
        continue;
      }
      if (result.op !== "upsert") continue;
      const pending = this.pending.get(`${result.tab}:${result.syncId}`);
      if (!pending) continue;
      const base = { ...pending.newBase };
      for (const conflict of result.conflicts ?? []) {
        const field = tab.fields.find(f => f.header === conflict.header);
        if (!field) continue;
        base[field.header] = pending.oldBase[field.header] ?? "";
        this.addConflict(result.tab, pending.entity, pending.rec, field, compareForm(field, pending.rec),
          rawCompareForm(tab, field, conflict.sheetValue), pending.oldBase[field.header] ?? "");
      }
      this.setBaseline(result.tab, pending.entity, pending.rec, base, result.row);
      if (pending.entity === "idea" && result.assigned && typeof result.assigned.id === "number") {
        pending.rec.sheetRef = result.assigned.id;
        this.dirty.add(`idea:${pending.rec.id}`);
      }
      const title = titleOf(pending.entity, pending.rec);
      const changed = Object.keys(this.ops.get(`${result.tab}:${result.syncId}`)?.values ?? {})
        .map(h => tab.fields.find(f => f.header === h)?.label ?? h);
      this.log("site→sheet", result.tab, pending.entity, result.syncId, result.created ? "created" : "updated", "ok",
        result.created ? `Added "${title}" to ${this.sheets[result.tab]?.sheetName ?? tab.label}` : `${changed.join(", ")} written for "${title}"`);
      this.counts.toSheet++;
    }

    const g = response.guardrails;
    if (this.guardrailPush && g) {
      if (!g.ok) {
        this.issues.push(`Guardrails: ${g.error}`);
      } else {
        const next = { ...this.guardrailBase };
        for (const c of g.conflicts ?? []) {
          const def = GUARDRAILS.find(d => d.key === c.header);
          if (def) next[def.key] = this.baselines.get("guardrails:all")?.values[def.key] ?? "";
        }
        this.writeGuardrailBaseline(next);
        this.log("site→sheet", "guardrails", "guardrail", "guardrails", "updated", "ok",
          `${Object.keys(this.guardrailPush.values).length} guardrail value(s) written`);
      }
    }
  }

  async persist() {
    const db = this.db;
    const statements: unknown[] = [];

    for (const key of this.inserted) {
      const [entity, id] = key.split(":") as [SyncedEntity, string];
      const rec = this.records.get(entity)?.get(id);
      if (rec) statements.push(db.insert(TABLE[entity]).values(rec as never));
    }
    for (const key of this.dirty) {
      if (this.inserted.has(key)) continue;
      const [entity, id] = key.split(":") as [SyncedEntity, string];
      const rec = this.records.get(entity)?.get(id);
      if (rec) statements.push(db.update(TABLE[entity]).set(rec as never).where(eq(TABLE[entity].id, id)));
    }
    for (const b of this.baselineWrites.values()) {
      statements.push(db.insert(s.syncBaselines).values(b).onConflictDoUpdate({
        target: s.syncBaselines.id, set: { values: b.values, row: b.row, syncedAt: b.syncedAt, entityId: b.entityId, syncId: b.syncId },
      }));
    }
    if (this.baselineDeletes.size) statements.push(db.delete(s.syncBaselines).where(inArray(s.syncBaselines.id, [...this.baselineDeletes])));
    for (const c of this.newConflicts) statements.push(db.insert(s.syncConflicts).values(c));
    if (this.resolvedConflicts.length) {
      statements.push(db.update(s.syncConflicts)
        .set({ status: "Resolved", resolution: "values now match", resolvedAt: this.at })
        .where(inArray(s.syncConflicts.id, this.resolvedConflicts)));
    }
    for (const key of this.guardrailDirty) {
      const value = this.guardrails.get(key) ?? null;
      statements.push(db.insert(s.guardrails).values({ key, value, updatedAt: this.at })
        .onConflictDoUpdate({ target: s.guardrails.key, set: { value, updatedAt: this.at } }));
    }
    for (const e of this.events) statements.push(db.insert(s.syncEvents).values(e));
    for (const h of this.historyRows) statements.push(db.insert(s.history).values(h));

    await runBatch(db, statements);
    // Keep the activity log small.
    const cutoff = await db.select({ at: s.syncEvents.at }).from(s.syncEvents).orderBy(desc(s.syncEvents.at)).limit(1).offset(1000);
    if (cutoff.length) await db.delete(s.syncEvents).where(lt(s.syncEvents.at, cutoff[0].at));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function titleOf(entity: SyncedEntity | string, rec: SyncRecord) {
  const pick = (k: string) => (typeof rec[k] === "string" && rec[k] ? String(rec[k]) : "");
  if (entity === "idea") return pick("title") || "Untitled idea";
  if (entity === "experiment") return pick("name") || pick("hypothesis") || pick("ideaLabel") || "Experiment";
  if (entity === "milestone") return pick("title") || pick("ideaLabel") || `Month ${rec.month ?? ""}`.trim();
  if (entity === "expense") return pick("item") || "Expense";
  if (entity === "sprintAction") return pick("action") || "Action";
  if (entity === "investment") return pick("name") || "Investment";
  if (entity === "investmentExperiment") return pick("name") || pick("investmentLabel") || "Investment experiment";
  return pick("title") || "Record";
}

function event(direction: string, tab: string, entityType: string, syncId: string, action: string, status: string, details: string): EventRow {
  return { id: newId(), at: now(), direction, tab, entityType, syncId, action, status, details };
}

async function saveMeta(db: Db, patch: SyncMeta) {
  const current = await readMeta(db);
  const value = { ...current, ...patch };
  await db.insert(s.appMeta).values({ key: "sync", value }).onConflictDoUpdate({ target: s.appMeta.key, set: { value } });
}

async function acquireLock(db: Db) {
  const row = await db.select().from(s.appMeta).where(eq(s.appMeta.key, "sync_lock")).get();
  const until = typeof row?.value === "number" ? row.value : 0;
  if (until > Date.now()) return false;
  const value = Date.now() + 90_000;
  await db.insert(s.appMeta).values({ key: "sync_lock", value }).onConflictDoUpdate({ target: s.appMeta.key, set: { value } });
  return true;
}

async function releaseLock(db: Db) {
  await db.insert(s.appMeta).values({ key: "sync_lock", value: 0 }).onConflictDoUpdate({ target: s.appMeta.key, set: { value: 0 } });
}
