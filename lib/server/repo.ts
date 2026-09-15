import { and, desc, eq, getTableColumns, isNull } from "drizzle-orm";
import * as s from "@/db/schema";
import type { Db } from "@/db";
import {
  ASSUMPTION_STATUSES, HORIZONS, INCOME_STYLES,
  type AppState, type Collection, type FinancialModel, type Idea, type SyncConflict,
} from "@/lib/domain";
import { GUARDRAILS, TABS, type SyncedEntity, type TabKey } from "@/lib/sync/tabs";
import { parseSheetValue } from "@/lib/sync/values";
import { runBatch } from "./batch";
import { blankExpense, blankExperiment, blankIdea, blankMilestone, blankSprintAction, newId, now, readRow } from "./records";
import { buildSummary, readMeta } from "./sync";

export const TABLES = {
  ideas: s.ideas, experiments: s.experiments, sprint: s.sprintActions, research: s.research,
  competitors: s.competitors, assumptions: s.assumptions, barriers: s.barriers, milestones: s.milestones,
  expenses: s.expenses, findings: s.findings,
} as const;

const ENTITY_TABLES: Record<SyncedEntity, (typeof TABLES)[keyof typeof TABLES]> = {
  idea: s.ideas, experiment: s.experiments, sprintAction: s.sprintActions, milestone: s.milestones, expense: s.expenses,
};

/** Columns only the system (import / sync / sheet formulas) may set. */
const PROTECTED = new Set([
  "id", "syncId", "createdAt", "updatedAt", "deletedAt", "source", "sourceWorkbook", "sourceSheet", "sourceRow",
  "importedAt", "sheetRef", "sheetShortScore", "sheetFitScore", "overallEffort", "sheetNetCash", "sheetNetHourly",
]);

export class MutationError extends Error {}

export type Mutation =
  | { op: "create"; collection: Collection; data: Record<string, unknown> }
  | { op: "update"; collection: Collection; id: string; data: Record<string, unknown> }
  | { op: "delete" | "restore"; collection: Collection; id: string }
  | { op: "saveFinancials"; ideaId: string; model: Partial<FinancialModel> }
  | { op: "setGuardrail"; key: string; value: string | number | null }
  | { op: "resolveConflict"; id: string; choice: "site" | "sheet" };

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function loadState(db: Db): Promise<AppState> {
  const [ideas, experiments, sprint, research, competitors, assumptions, barriers, milestones, expenses, findings, financials, guardrails, history, conflicts, baselines] =
    await db.batch([
      db.select().from(s.ideas),
      db.select().from(s.experiments).where(isNull(s.experiments.deletedAt)),
      db.select().from(s.sprintActions).where(isNull(s.sprintActions.deletedAt)),
      db.select().from(s.research).where(isNull(s.research.deletedAt)),
      db.select().from(s.competitors).where(isNull(s.competitors.deletedAt)),
      db.select().from(s.assumptions).where(isNull(s.assumptions.deletedAt)),
      db.select().from(s.barriers).where(isNull(s.barriers.deletedAt)),
      db.select().from(s.milestones).where(isNull(s.milestones.deletedAt)),
      db.select().from(s.expenses).where(isNull(s.expenses.deletedAt)),
      db.select().from(s.findings).where(isNull(s.findings.deletedAt)),
      db.select().from(s.financialModels),
      db.select().from(s.guardrails),
      db.select().from(s.history).orderBy(desc(s.history.at)).limit(400),
      db.select().from(s.syncConflicts).where(eq(s.syncConflicts.status, "Open")),
      db.select({ tab: s.syncBaselines.tab, syncId: s.syncBaselines.syncId, row: s.syncBaselines.row }).from(s.syncBaselines),
    ]);
  const meta = await readMeta(db);
  const sheetRows: AppState["sheetRows"] = {};
  for (const b of baselines) (sheetRows[b.syncId] ??= []).push({ tab: b.tab, row: b.row });

  return {
    ideas: ideas as unknown as Idea[],
    experiments: experiments as unknown as AppState["experiments"],
    sprint: sprint as unknown as AppState["sprint"],
    research: research as unknown as AppState["research"],
    competitors: competitors as unknown as AppState["competitors"],
    assumptions: assumptions as unknown as AppState["assumptions"],
    barriers: barriers as unknown as AppState["barriers"],
    milestones: milestones as unknown as AppState["milestones"],
    expenses: expenses as unknown as AppState["expenses"],
    findings: findings as unknown as AppState["findings"],
    financials: financials.map(f => ({ ...(f.data as unknown as FinancialModel), ideaId: f.ideaId, updatedAt: f.updatedAt })),
    guardrails: Object.fromEntries(guardrails.map(g => [g.key, g.value ?? null])),
    history,
    conflicts: conflicts as unknown as SyncConflict[],
    sync: buildSummary(meta, conflicts.length),
    sheetRows,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function mutate(db: Db, m: Mutation): Promise<{ id?: string }> {
  switch (m.op) {
    case "create": return create(db, m.collection, m.data ?? {});
    case "update": return update(db, m.collection, m.id, m.data ?? {});
    case "delete": return setDeleted(db, m.collection, m.id, true);
    case "restore": return setDeleted(db, m.collection, m.id, false);
    case "saveFinancials": return saveFinancials(db, m.ideaId, m.model ?? {});
    case "setGuardrail": return setGuardrail(db, m.key, m.value);
    case "resolveConflict": return resolveConflict(db, m.id, m.choice);
    default: throw new MutationError("Unknown operation");
  }
}

function table(collection: Collection) {
  const t = TABLES[collection];
  if (!t) throw new MutationError(`Unknown collection: ${collection}`);
  return t;
}

function coerce(collection: Collection, input: Record<string, unknown>) {
  const columns = getTableColumns(table(collection)) as unknown as Record<string, { columnType: string; notNull: boolean }>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const col = columns[key];
    if (!col || PROTECTED.has(key)) continue;
    if (col.columnType === "SQLiteReal" || col.columnType === "SQLiteInteger") {
      const n = value === "" || value === null || value === undefined ? null : Number(value);
      out[key] = n !== null && Number.isFinite(n) ? n : null;
    } else if (col.columnType === "SQLiteTextJson") {
      out[key] = value ?? (key === "details" ? {} : []);
    } else {
      out[key] = value === null || value === undefined || value === ""
        ? (col.notNull ? "" : null)
        : String(value).slice(0, 20000);
    }
  }
  return out;
}

function validateIdea(values: Record<string, unknown>) {
  if ("title" in values && !String(values.title ?? "").trim()) throw new MutationError("An idea needs a name.");
  if ("horizon" in values && !HORIZONS.includes(values.horizon as (typeof HORIZONS)[number])) throw new MutationError("Horizon must be Short Term, Long Term, or Both.");
  if ("incomeStyle" in values && !INCOME_STYLES.includes(values.incomeStyle as (typeof INCOME_STYLES)[number])) throw new MutationError("Income style must be Active, Hybrid, or Passive-ish.");
}

async function ideaById(db: Db, id: unknown) {
  if (typeof id !== "string" || !id) return null;
  return (await db.select().from(s.ideas).where(eq(s.ideas.id, id)).get()) ?? null;
}

function historyRow(ideaId: string | null, entityType: string, entityId: string, kind: string, summary: string) {
  return { id: newId(), ideaId, entityType, entityId, kind, summary, at: now() };
}

async function create(db: Db, collection: Collection, data: Record<string, unknown>) {
  const values = coerce(collection, data);
  const t = now();
  const idea = await ideaById(db, values.ideaId);
  let record: Record<string, unknown>;

  switch (collection) {
    case "ideas":
      validateIdea({ title: values.title ?? "", ...values });
      record = blankIdea({ ...(values as Partial<Idea>), title: String(values.title).trim() }) as unknown as Record<string, unknown>;
      break;
    case "experiments":
      record = blankExperiment(values) as unknown as Record<string, unknown>;
      if (idea && !record.ideaLabel) record.ideaLabel = idea.title;
      break;
    case "sprint":
      record = blankSprintAction(values) as unknown as Record<string, unknown>;
      break;
    case "milestones":
      record = blankMilestone(values) as unknown as Record<string, unknown>;
      if (idea && !record.ideaLabel) record.ideaLabel = idea.title;
      break;
    case "expenses":
      record = blankExpense(values) as unknown as Record<string, unknown>;
      if (idea && !record.ideaLabel) record.ideaLabel = idea.title;
      break;
    default: {
      const defaults: Partial<Record<Collection, Record<string, unknown>>> = {
        competitors: { name: "Untitled competitor" },
        assumptions: { assumption: "New assumption", status: "Unknown" },
        barriers: { type: "capital" },
        findings: { title: "Untitled finding", scope: idea ? "Idea" : "Global" },
        research: { kind: "Note", area: "General", tags: [] },
      };
      record = { id: newId(), ...defaults[collection], ...values, createdAt: t, updatedAt: t, deletedAt: null };
      if (collection === "assumptions" && !ASSUMPTION_STATUSES.includes(String(record.status))) record.status = "Unknown";
    }
  }

  const statements: unknown[] = [db.insert(table(collection)).values(record as never)];
  if (collection === "ideas") {
    statements.push(db.insert(s.history).values(historyRow(String(record.id), "idea", String(record.id), "created", `Idea created on the site (${record.horizon}, ${record.incomeStyle})`)));
  } else if (collection === "experiments" && idea) {
    statements.push(db.insert(s.history).values(historyRow(idea.id, "experiment", String(record.id), "created", `Experiment added: ${record.name || record.hypothesis || "untitled"}`)));
  }
  await runBatch(db, statements);
  return { id: String(record.id) };
}

async function update(db: Db, collection: Collection, id: string, data: Record<string, unknown>) {
  const t = table(collection);
  const current = (await db.select().from(t).where(eq(t.id, id)).get()) as Record<string, unknown> | undefined;
  if (!current) throw new MutationError("That record no longer exists.");
  const values = coerce(collection, data);
  if (collection === "ideas") validateIdea(values);
  if (!Object.keys(values).length) return { id };
  const stamp = now();
  values.updatedAt = stamp;

  const statements: unknown[] = [db.update(t).set(values as never).where(eq(t.id, id))];

  if (collection === "ideas") {
    const labels: Record<string, string> = { stage: "Stage", status: "Status", horizon: "Horizon", incomeStyle: "Income style" };
    for (const [field, label] of Object.entries(labels)) {
      if (field in values && values[field] !== current[field]) {
        statements.push(db.insert(s.history).values(historyRow(id, "idea", id, field, `${label} changed from ${current[field] || "—"} to ${values[field]}`)));
      }
    }
    if (typeof values.title === "string" && values.title !== current.title) {
      statements.push(db.insert(s.history).values(historyRow(id, "idea", id, "title", `Renamed from "${current.title}"`)));
      // Keep the Sheet's free-text idea columns pointing at the renamed idea.
      for (const child of [s.experiments, s.milestones, s.expenses]) {
        statements.push(db.update(child).set({ ideaLabel: values.title, updatedAt: stamp })
          .where(and(eq(child.ideaId, id), eq(child.ideaLabel, String(current.title)))));
      }
    }
  }
  if (collection === "experiments" && values.finalDecision && values.finalDecision !== current.finalDecision) {
    statements.push(db.insert(s.history).values(historyRow(
      (current.ideaId as string | null) ?? null, "experiment", id, "decision",
      `Experiment decision: ${values.finalDecision}${current.name ? ` — ${current.name}` : ""}`)));
  }
  await runBatch(db, statements);
  return { id };
}

async function setDeleted(db: Db, collection: Collection, id: string, deleted: boolean) {
  const t = table(collection);
  const current = (await db.select().from(t).where(eq(t.id, id)).get()) as Record<string, unknown> | undefined;
  if (!current) throw new MutationError("That record no longer exists.");
  const stamp = now();
  const statements: unknown[] = [db.update(t).set({ deletedAt: deleted ? stamp : null, updatedAt: stamp } as never).where(eq(t.id, id))];
  if (collection === "ideas" || collection === "experiments") {
    const ideaId = collection === "ideas" ? id : (current.ideaId as string | null) ?? null;
    const name = String(current.title ?? current.name ?? current.hypothesis ?? "record");
    statements.push(db.insert(s.history).values(historyRow(ideaId, collection === "ideas" ? "idea" : "experiment", id,
      deleted ? "deleted" : "restored", deleted ? `Archived "${name}" on the site` : `Restored "${name}"`)));
  }
  await runBatch(db, statements);
  return { id };
}

async function saveFinancials(db: Db, ideaId: string, model: Partial<FinancialModel>) {
  if (!(await ideaById(db, ideaId))) throw new MutationError("That idea no longer exists.");
  const { ideaId: _ignored, updatedAt: _stamp, ...data } = model;
  void _ignored; void _stamp;
  const stamp = now();
  await db.insert(s.financialModels).values({ ideaId, data, updatedAt: stamp })
    .onConflictDoUpdate({ target: s.financialModels.ideaId, set: { data, updatedAt: stamp } });
  return { id: ideaId };
}

async function setGuardrail(db: Db, key: string, value: string | number | null) {
  const def = GUARDRAILS.find(g => g.key === key);
  if (!def) throw new MutationError("Unknown guardrail.");
  let stored: string | number | null = value === "" ? null : value;
  if (def.type === "number" && stored !== null) {
    const n = Number(stored);
    stored = Number.isFinite(n) ? n : null;
  }
  const stamp = now();
  await db.insert(s.guardrails).values({ key, value: stored, updatedAt: stamp })
    .onConflictDoUpdate({ target: s.guardrails.key, set: { value: stored, updatedAt: stamp } });
  return { id: key };
}

/**
 * "Use Site" rewrites the baseline to the sheet's value, so the next sync sees only the
 * site as changed and pushes it. "Use Sheet" copies the sheet value in and agrees on it.
 */
async function resolveConflict(db: Db, id: string, choice: "site" | "sheet") {
  const c = await db.select().from(s.syncConflicts).where(eq(s.syncConflicts.id, id)).get();
  if (!c || c.status !== "Open") return { id };
  const stamp = now();
  const statements: unknown[] = [];

  if (c.tab === "guardrails") {
    const base = await db.select().from(s.syncBaselines).where(eq(s.syncBaselines.id, "guardrails:all")).get();
    if (choice === "sheet") {
      const def = GUARDRAILS.find(g => g.key === c.field);
      const parsed = parseSheetValue(c.sheetValue, def?.type ?? "text");
      const value = parsed.ok ? parsed.value : c.sheetValue;
      statements.push(db.insert(s.guardrails).values({ key: c.field, value, updatedAt: stamp })
        .onConflictDoUpdate({ target: s.guardrails.key, set: { value, updatedAt: stamp } }));
    }
    if (base) {
      statements.push(db.update(s.syncBaselines).set({ values: { ...base.values, [c.field]: c.sheetValue } }).where(eq(s.syncBaselines.id, base.id)));
    }
  } else {
    const tab = TABS[c.tab as TabKey];
    const field = tab?.fields.find(f => f.field === c.field);
    if (!tab || !field) throw new MutationError("Unknown conflict field.");
    const entityTable = ENTITY_TABLES[tab.entity];
    if (choice === "sheet") {
      const typed = readRow(tab, { [field.header]: c.sheetValue }).values;
      statements.push(db.update(entityTable).set({ [field.field]: typed[field.field] ?? null, updatedAt: stamp } as never).where(eq(entityTable.id, c.entityId)));
    }
    const baseId = `${c.tab}:${c.syncId}`;
    const base = await db.select().from(s.syncBaselines).where(eq(s.syncBaselines.id, baseId)).get();
    if (base) {
      statements.push(db.update(s.syncBaselines).set({ values: { ...base.values, [field.header]: c.sheetValue } }).where(eq(s.syncBaselines.id, baseId)));
    }
  }

  statements.push(db.update(s.syncConflicts)
    .set({ status: "Resolved", resolution: choice === "site" ? "Kept the site value" : "Kept the Google Sheet value", resolvedAt: stamp })
    .where(eq(s.syncConflicts.id, id)));
  statements.push(db.insert(s.syncEvents).values({
    id: newId(), at: stamp, direction: choice === "site" ? "site→sheet" : "sheet→site", tab: c.tab, entityType: c.entityType,
    syncId: c.syncId, action: "resolved", status: "ok",
    details: `${c.label} conflict on "${c.title}" resolved — kept the ${choice === "site" ? "site" : "Google Sheet"} value`,
  }));
  await runBatch(db, statements);
  return { id };
}
