import type { Experiment, Expense, Idea, Milestone, SprintAction } from "@/lib/domain";
import { inferOpportunityType, inferShortIncomeStyle, normalizeTitle } from "@/lib/domain";
import { TABS, WORKBOOKS, styleFromSheet, styleToSheet, type FieldMap, type SyncedEntity, type TabDef, type TabKey } from "@/lib/sync/tabs";
import { normalize, parseSheetValue } from "@/lib/sync/values";

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

/** Loose record shape the sync engine works with — every synced table has these columns. */
export type SyncRecord = {
  [key: string]: unknown;
  id: string;
  syncId: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const stamp = () => {
  const t = now();
  return { createdAt: t, updatedAt: t, deletedAt: null };
};

const provenance = { source: "site", sourceWorkbook: null, sourceSheet: null, sourceRow: null, importedAt: null };

export function blankIdea(partial: Partial<Idea> = {}): Idea {
  return {
    id: newId(), syncId: newId(), title: "", description: "", horizon: "Short Term", incomeStyle: "Active",
    opportunityType: "Other", category: "", status: "Exploring", stage: "Discover", tier: "", sheetRef: null,
    personalFitAngle: "", howItEarns: "", incomeModel: "", firstCash: "", weeksToFirst: null,
    startupLow: null, startupHigh: null, monthlyCost: null, weeklyHours: null, monthlyLow: null, monthlyHigh: null,
    maintenanceHours: null, speed: null, fit: null, demand: null, scale: null, lowCost: null, lowRisk: null,
    skillFit: null, interest: null, riskComfort: null, passivePotential: null, setupEffort: null, ongoingEffort: null,
    salesEffort: null, complexity: null, overallEffort: null, sheetShortScore: null, sheetFitScore: null,
    firstTest: "", notes: "", details: {},
    ...provenance, ...stamp(), ...partial,
  };
}

export function blankExperiment(partial: Partial<Experiment> = {}): Experiment {
  return {
    id: newId(), syncId: newId(), ideaId: null, ideaLabel: "", name: "", status: "Planned", startDate: null,
    decisionDate: null, hypothesis: "", testAction: "", budget: null, timeBudget: null, actualHours: null, leads: null,
    replies: null, sales: null, revenue: null, directCosts: null, sheetNetCash: null, sheetNetHourly: null,
    successSignal: "", result: "", learning: "", finalDecision: "", assumptionId: null,
    ...provenance, ...stamp(), ...partial,
  } as Experiment;
}

export function blankSprintAction(partial: Partial<SprintAction> = {}): SprintAction {
  return {
    id: newId(), syncId: newId(), ideaId: null, day: "", status: "", action: "", deliverable: "", time: "",
    costCap: null, successSignal: "", resultNotes: "",
    ...provenance, ...stamp(), ...partial,
  } as SprintAction;
}

export function blankMilestone(partial: Partial<Milestone> = {}): Milestone {
  return {
    id: newId(), syncId: newId(), ideaId: null, ideaLabel: "", month: null, title: "", stage: "Discover",
    targetDate: null, status: "Not Started", spendingCap: null, timeBudget: null, targetIncome: null,
    actualIncome: null, nextAction: "", evidenceNotes: "",
    ...provenance, ...stamp(), ...partial,
  } as Milestone;
}

export function blankExpense(partial: Partial<Expense> = {}): Expense {
  return {
    id: newId(), syncId: newId(), ideaId: null, ideaLabel: "", category: "", costType: "", item: "", low: null,
    high: null, actual: null, essential: "", dueDate: null, notes: "",
    ...provenance, ...stamp(), ...partial,
  } as Expense;
}

export const BLANK: Record<SyncedEntity, () => SyncRecord> = {
  idea: () => blankIdea() as unknown as SyncRecord,
  experiment: () => blankExperiment() as unknown as SyncRecord,
  sprintAction: () => blankSprintAction() as unknown as SyncRecord,
  milestone: () => blankMilestone() as unknown as SyncRecord,
  expense: () => blankExpense() as unknown as SyncRecord,
};

/** Typed site values for every mapped column present in a pulled row. */
export function readRow(tab: TabDef, values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const invalid = new Set<string>();
  for (const field of tab.fields) {
    if (!(field.header in values)) continue;
    const parsed = parseSheetValue(values[field.header], field.type);
    if (!parsed.ok) {
      invalid.add(field.field);
      continue;
    }
    let value = parsed.value;
    if (field.transform === "style" && typeof value === "string") value = value ? styleFromSheet(value) : value;
    out[field.field] = value;
  }
  return { values: out, invalid };
}

/** The value a record contributes to a sheet column (site vocabulary translated back). */
export function sheetValueOf(field: FieldMap, record: Record<string, unknown>): string | number | null {
  let value = record[field.field];
  if (value === undefined) return null;
  if (field.transform === "style" && typeof value === "string") value = styleToSheet(value);
  return value as string | number | null;
}

/** Normalized comparison form for a field, from either a site record or typed sheet values. */
export const compareForm = (field: FieldMap, record: Record<string, unknown>) => normalize(sheetValueOf(field, record));

/** Normalized sheet-side form of a raw cell value (as returned by the Apps Script). */
export function rawCompareForm(tab: TabDef, field: FieldMap, raw: unknown) {
  const { values, invalid } = readRow(tab, { [field.header]: raw });
  return invalid.has(field.field) ? normalize(raw) : compareForm(field, values);
}

export function resolveIdeaId(label: string, ideas: Iterable<SyncRecord>): string | null {
  const wanted = normalizeTitle(label);
  if (!wanted) return null;
  for (const idea of ideas) {
    if (!idea.deletedAt && normalizeTitle(String(idea.title ?? "")) === wanted) return idea.id;
  }
  return null;
}

/** Builds a new site record from a Sheet row that has no site counterpart yet. */
export function recordFromRow(
  tabKey: TabKey,
  typed: Record<string, unknown>,
  meta: { row: number; sheetName: string; syncId: string; source?: string; importedAt?: string },
  ideas: Iterable<SyncRecord>,
): SyncRecord {
  const tab = TABS[tabKey];
  const record = { ...BLANK[tab.entity](), ...typed } as SyncRecord;
  Object.assign(record, {
    syncId: meta.syncId,
    source: meta.source ?? "sheet",
    sourceWorkbook: WORKBOOKS[tab.workbook].name,
    sourceSheet: meta.sheetName,
    sourceRow: meta.row,
    importedAt: meta.importedAt ?? now(),
  });

  if (tab.entity === "idea") {
    record.horizon = tabKey === "shortIdeas" ? "Short Term" : "Long Term";
    record.opportunityType = inferOpportunityType(String(record.category ?? ""), String(record.title ?? ""));
    if (tabKey === "shortIdeas") record.incomeStyle = inferShortIncomeStyle(String(record.category ?? ""));
    if (!["Active", "Hybrid", "Passive-ish"].includes(String(record.incomeStyle))) record.incomeStyle = "Active";
    if (!record.status) record.status = "Exploring";
    record.stage = "Discover";
  } else if ("ideaLabel" in record) {
    record.ideaId = resolveIdeaId(String(record.ideaLabel ?? ""), ideas);
  }
  if (tab.entity === "milestone" && !record.stage) record.stage = "Discover";
  if (tab.entity === "milestone" && !record.status) record.status = "Not Started";
  return record;
}
