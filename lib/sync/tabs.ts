import type { FieldType } from "./values";

export type WorkbookKey = "short" | "long";
export type TabKey = "shortIdeas" | "longIdeas" | "experiments" | "sprint" | "plan" | "costs";
export type SyncedEntity = "idea" | "experiment" | "sprintAction" | "milestone" | "expense";

export type FieldMap = {
  /** Normalized header text (lowercase, dashes unified) exactly as the Apps Script reports it. */
  header: string;
  /** Property on the site record. */
  field: string;
  type: FieldType;
  label: string;
  /** Calculated in the sheet (formula). Pulled for reference, never written or conflicted. */
  readOnly?: boolean;
  /** Long-term "Style" says Passive; the site says Passive-ish. */
  transform?: "style";
};

export type TabDef = {
  key: TabKey;
  label: string;
  workbook: WorkbookKey;
  entity: SyncedEntity;
  titleField: string;
  fields: FieldMap[];
};

export const WORKBOOKS: Record<WorkbookKey, { id: string; name: string; short: string }> = {
  short: {
    id: "1rEDmWfsFzu4_KiXdzpZEBvupqZwdakL5R86ZEQYlCOo",
    name: "Randy — Short Term Income Discovery Workbook",
    short: "Short-Term Workbook",
  },
  long: {
    id: "1Z3Awg4j-QJYxOj88KOnBZhsFbGxTtw3Bi6TgybBHGYA",
    name: "Long Term Income Discovery Workbook – Effort & Cost Planning",
    short: "Long-Term Workbook",
  },
};

export function workbookUrl(workbook: WorkbookKey, gid?: number | null, row?: number | null) {
  const base = `https://docs.google.com/spreadsheets/d/${WORKBOOKS[workbook].id}/edit`;
  if (gid === undefined || gid === null) return base;
  return `${base}#gid=${gid}${row ? `&range=A${row}` : ""}`;
}

const f = (header: string, field: string, type: FieldType, label: string, extra: Partial<FieldMap> = {}): FieldMap => ({
  header, field, type, label, ...extra,
});

export const TABS: Record<TabKey, TabDef> = {
  shortIdeas: {
    key: "shortIdeas", label: "Income Ideas", workbook: "short", entity: "idea", titleField: "title",
    fields: [
      f("id", "sheetRef", "number", "ID", { readOnly: true }),
      f("status", "status", "text", "Status"),
      f("tier", "tier", "text", "Tier"),
      f("category", "category", "text", "Category"),
      f("opportunity", "title", "text", "Opportunity"),
      f("personal fit / angle", "personalFitAngle", "text", "Personal fit / angle"),
      f("first cash", "firstCash", "text", "First cash"),
      f("startup cost", "startupLow", "number", "Startup cost"),
      f("weekly hrs", "weeklyHours", "number", "Weekly hrs"),
      f("income model", "incomeModel", "text", "Income model"),
      f("low monthly", "monthlyLow", "number", "Low monthly"),
      f("high monthly", "monthlyHigh", "number", "High monthly"),
      f("speed 1-5", "speed", "number", "Speed 1–5"),
      f("fit 1-5", "fit", "number", "Fit 1–5"),
      f("demand 1-5", "demand", "number", "Demand 1–5"),
      f("scale 1-5", "scale", "number", "Scale 1–5"),
      f("low cost 1-5", "lowCost", "number", "Low cost 1–5"),
      f("low risk 1-5", "lowRisk", "number", "Low risk 1–5"),
      f("score /100", "sheetShortScore", "number", "Score /100", { readOnly: true }),
      f("first test", "firstTest", "text", "First test"),
    ],
  },
  longIdeas: {
    key: "longIdeas", label: "Income Options", workbook: "long", entity: "idea", titleField: "title",
    fields: [
      f("category", "category", "text", "Category"),
      f("income path", "title", "text", "Income Path"),
      f("how it earns", "howItEarns", "text", "How It Earns"),
      f("style", "incomeStyle", "text", "Style", { transform: "style" }),
      f("startup low", "startupLow", "number", "Startup Low"),
      f("startup high", "startupHigh", "number", "Startup High"),
      f("monthly cost", "monthlyCost", "number", "Monthly Cost"),
      f("weeks to first $", "weeksToFirst", "number", "Weeks to First $"),
      f("hours / week", "weeklyHours", "number", "Hours / Week"),
      f("monthly income low", "monthlyLow", "number", "Monthly Income Low"),
      f("monthly income high", "monthlyHigh", "number", "Monthly Income High"),
      f("skill fit 1-5", "skillFit", "number", "Skill Fit 1–5"),
      f("interest 1-5", "interest", "number", "Interest 1–5"),
      f("risk comfort 1-5", "riskComfort", "number", "Risk Comfort 1–5"),
      f("passive potential 1-5", "passivePotential", "number", "Passive Potential 1–5"),
      f("setup effort 1-5", "setupEffort", "number", "Setup Effort 1–5"),
      f("ongoing effort 1-5", "ongoingEffort", "number", "Ongoing Effort 1–5"),
      f("sales effort 1-5", "salesEffort", "number", "Sales Effort 1–5"),
      f("complexity 1-5", "complexity", "number", "Complexity 1–5"),
      f("overall effort 1-5", "overallEffort", "number", "Overall Effort 1–5", { readOnly: true }),
      f("fit score /100", "sheetFitScore", "number", "Fit Score /100", { readOnly: true }),
      f("status", "status", "text", "Status"),
      f("first low-cost test", "firstTest", "text", "First Low-Cost Test"),
      f("notes", "notes", "text", "Notes"),
    ],
  },
  experiments: {
    key: "experiments", label: "Short Term Income Tracker", workbook: "short", entity: "experiment", titleField: "ideaLabel",
    fields: [
      f("idea", "ideaLabel", "text", "Idea"),
      f("status", "status", "text", "Status"),
      f("start date", "startDate", "date", "Start date"),
      f("decision date", "decisionDate", "date", "Decision date"),
      f("hypothesis", "hypothesis", "text", "Hypothesis"),
      f("test action", "testAction", "text", "Test action"),
      f("budget", "budget", "number", "Budget"),
      f("hours", "actualHours", "number", "Hours"),
      f("leads", "leads", "number", "Leads"),
      f("replies", "replies", "number", "Replies"),
      f("sales", "sales", "number", "Sales"),
      f("revenue", "revenue", "number", "Revenue"),
      f("direct cost", "directCosts", "number", "Direct cost"),
      f("net cash", "sheetNetCash", "number", "Net cash", { readOnly: true }),
      f("net $/hr", "sheetNetHourly", "number", "Net $/hr", { readOnly: true }),
      f("decision / learning", "learning", "text", "Decision / learning"),
    ],
  },
  sprint: {
    key: "sprint", label: "Actualizing Template", workbook: "short", entity: "sprintAction", titleField: "action",
    fields: [
      f("day", "day", "text", "Day"),
      f("status", "status", "text", "Status"),
      f("action", "action", "text", "Action"),
      f("deliverable", "deliverable", "text", "Deliverable"),
      f("time", "time", "text", "Time"),
      f("cost cap", "costCap", "number", "Cost cap"),
      f("success signal", "successSignal", "text", "Success signal"),
      f("result / notes", "resultNotes", "text", "Result / notes"),
    ],
  },
  plan: {
    key: "plan", label: "12-Month Plan", workbook: "long", entity: "milestone", titleField: "title",
    fields: [
      f("month", "month", "number", "Month"),
      f("income path", "ideaLabel", "text", "Income Path"),
      f("stage", "stage", "text", "Stage"),
      f("milestone / hypothesis", "title", "text", "Milestone / Hypothesis"),
      f("target date", "targetDate", "date", "Target Date"),
      f("time budget hrs", "timeBudget", "number", "Time Budget Hrs"),
      f("spending cap", "spendingCap", "number", "Spending Cap"),
      f("target monthly income", "targetIncome", "number", "Target Monthly Income"),
      f("actual monthly income", "actualIncome", "number", "Actual Monthly Income"),
      f("status", "status", "text", "Status"),
      f("next action", "nextAction", "text", "Next Action"),
      f("evidence / decision notes", "evidenceNotes", "text", "Evidence / Decision Notes"),
    ],
  },
  costs: {
    key: "costs", label: "Cost Planner", workbook: "long", entity: "expense", titleField: "item",
    fields: [
      f("income path", "ideaLabel", "text", "Income Path"),
      f("expense category", "category", "text", "Expense Category"),
      f("cost type", "costType", "text", "Cost Type"),
      f("expense item", "item", "text", "Expense Item"),
      f("low estimate", "low", "number", "Low Estimate"),
      f("high estimate", "high", "number", "High Estimate"),
      f("actual", "actual", "number", "Actual"),
      f("essential?", "essential", "text", "Essential?"),
      f("due / start date", "dueDate", "date", "Due / Start Date"),
      f("notes / vendor", "notes", "text", "Notes / Vendor"),
    ],
  },
};

export const TAB_ORDER: TabKey[] = ["shortIdeas", "longIdeas", "experiments", "sprint", "plan", "costs"];

export type GuardrailDef = { key: string; label: string; type: FieldType; group: "situation" | "weights"; hint: string };

/** Label/value pairs on the long-term workbook's Start Here tab. `key` is the normalized label. */
export const GUARDRAILS: GuardrailDef[] = [
  { key: "monthly income needed", label: "Monthly Income Needed", type: "number", group: "situation", hint: "Your minimum target before taxes" },
  { key: "cash available to start", label: "Cash Available to Start", type: "number", group: "situation", hint: "Amount you can invest without risking essentials" },
  { key: "hours available per week", label: "Hours Available per Week", type: "number", group: "situation", hint: "Realistic capacity for earning + building" },
  { key: "desired weeks to first income", label: "Desired Weeks to First Income", type: "number", group: "situation", hint: "Use a conservative target" },
  { key: "risk tolerance (1-5)", label: "Risk Tolerance (1–5)", type: "number", group: "situation", hint: "1 = very cautious; 5 = comfortable with uncertainty" },
  { key: "preferred income style", label: "Preferred Income Style", type: "text", group: "situation", hint: "Active, Passive, or Hybrid" },
  { key: "preferred work setting", label: "Preferred Work Setting", type: "text", group: "situation", hint: "Remote, Local, or Flexible" },
  { key: "location / service area", label: "Location / Service Area", type: "text", group: "situation", hint: "City/region if local work is possible" },
  { key: "benefits / severance runway ends", label: "Benefits / Severance Runway Ends", type: "date", group: "situation", hint: "Optional planning date" },
  { key: "strongest skills", label: "Strongest Skills", type: "text", group: "situation", hint: "Sales, operations, writing, trades, analytics…" },
  { key: "useful assets", label: "Useful Assets", type: "text", group: "situation", hint: "Car, tools, room, equipment, audience, licenses…" },
  { key: "constraints", label: "Constraints", type: "text", group: "situation", hint: "Health, caregiving, schedule, transport, non-compete…" },
  { key: "non-negotiables", label: "Non-Negotiables", type: "text", group: "situation", hint: "Values, income floor, schedule, location, benefits" },
  { key: "skill fit weight", label: "Skill Fit Weight", type: "number", group: "weights", hint: "How strongly current abilities should count" },
  { key: "interest weight", label: "Interest Weight", type: "number", group: "weights", hint: "Motivation and enjoyment" },
  { key: "risk comfort weight", label: "Risk Comfort Weight", type: "number", group: "weights", hint: "Confidence with uncertainty / downside" },
  { key: "passive potential weight", label: "Passive Potential Weight", type: "number", group: "weights", hint: "Ability to decouple income from hours later" },
  { key: "speed weight", label: "Speed Weight", type: "number", group: "weights", hint: "Importance of reaching first revenue quickly" },
  { key: "income potential weight", label: "Income Potential Weight", type: "number", group: "weights", hint: "Importance of higher long-term monthly potential" },
  { key: "low effort weight", label: "Low Effort Weight", type: "number", group: "weights", hint: "Preference for lighter setup, delivery, sales, complexity" },
];

export function styleFromSheet(value: string) {
  const v = value.trim().toLowerCase();
  if (v.startsWith("passive")) return "Passive-ish";
  if (v === "hybrid") return "Hybrid";
  if (v === "active") return "Active";
  return value.trim();
}

export function styleToSheet(value: string) {
  return value === "Passive-ish" ? "Passive" : value;
}
