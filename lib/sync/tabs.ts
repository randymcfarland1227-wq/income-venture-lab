import type { FieldType } from "./values";

export type WorkbookKey = "short" | "long";
export type TabKey = "shortIdeas" | "longIdeas" | "experiments" | "sprint" | "plan" | "costs" | "investments" | "investmentExperiments";
export type SyncedEntity = "idea" | "experiment" | "sprintAction" | "milestone" | "expense" | "investment" | "investmentExperiment";

export type FieldMap = {
  /** Normalized header text (lowercase, dashes unified) exactly as the Apps Script reports it. */
  header: string;
  /** Property on the site record. */
  field: string;
  type: FieldType;
  label: string;
  /** Calculated in the sheet (formula). Pulled for reference, never written or conflicted. */
  readOnly?: boolean;
  /** twoWay is personal/user data; appToSheet is external or calculated authority. */
  authority?: "twoWay" | "appToSheet";
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
    name: "Long-Term Income Strategy Workbook",
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
    key: "longIdeas", label: "Long-Term Strategy", workbook: "long", entity: "idea", titleField: "title",
    fields: [
      f("strategic role", "strategicRole", "text", "Strategic Role"),
      f("strategy / path", "title", "text", "Strategy / Path"),
      f("why it matters", "description", "text", "Why It Matters"),
      f("income engine", "howItEarns", "text", "Income Engine"),
      f("involvement", "incomeStyle", "text", "Involvement", { transform: "style" }),
      f("1-year foundation", "year1", "text", "1-Year Foundation"),
      f("3-year position", "year3", "text", "3-Year Position"),
      f("5-year outcome", "year5", "text", "5-Year Outcome"),
      f("10-year vision", "year10", "text", "10-Year Vision"),
      f("durable advantage", "durableAdvantage", "text", "Durable Advantage"),
      f("key dependencies", "dependencies", "text", "Key Dependencies"),
      f("starting capital low", "startupLow", "number", "Starting Capital Low"),
      f("starting capital high", "startupHigh", "number", "Starting Capital High"),
      f("weekly hours (year 1)", "weeklyHours", "number", "Weekly Hours (Year 1)"),
      f("long-term monthly income low", "monthlyLow", "number", "Long-Term Monthly Income Low"),
      f("long-term monthly income high", "monthlyHigh", "number", "Long-Term Monthly Income High"),
      f("risk comfort 1-5", "riskComfort", "number", "Risk Comfort 1–5"),
      f("passive potential 1-5", "passivePotential", "number", "Passive Potential 1–5"),
      f("status", "status", "text", "Status"),
      f("next 12-month move", "firstTest", "text", "Next 12-Month Move"),
      f("success measure", "successMeasure", "text", "Success Measure"),
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
  investments: {
    key: "investments", label: "Investing & Assets", workbook: "long", entity: "investment", titleField: "name",
    fields: [
      f("status", "status", "text", "Status"),
      f("classification", "classification", "text", "Classification"),
      f("category", "category", "text", "Category"),
      f("investment / account", "name", "text", "Investment / Account"),
      f("symbol / series", "symbol", "text", "Symbol / Series"),
      f("account or asset", "accountOrAsset", "text", "Account or Asset"),
      f("definition", "definition", "text", "Definition"),
      f("how it earns", "returnMechanism", "text", "How It Earns"),
      f("typical horizon", "horizon", "text", "Typical Horizon"),
      f("liquidity", "liquidity", "text", "Liquidity"),
      f("income frequency", "incomeFrequency", "text", "Income Frequency"),
      f("market risk", "riskMarket", "text", "Market Risk", { authority: "appToSheet" }),
      f("principal risk", "riskPrincipal", "text", "Principal Risk", { authority: "appToSheet" }),
      f("credit risk", "riskCredit", "text", "Credit Risk", { authority: "appToSheet" }),
      f("interest rate risk", "riskInterestRate", "text", "Interest Rate Risk", { authority: "appToSheet" }),
      f("inflation risk", "riskInflation", "text", "Inflation Risk", { authority: "appToSheet" }),
      f("complexity", "riskComplexity", "text", "Complexity", { authority: "appToSheet" }),
      f("passive level", "passiveLevel", "text", "Passive Level"),
      f("minimum / access notes", "minimumAccessNotes", "text", "Minimum / Access Notes"),
      f("fees / expense notes", "feesExpenseNotes", "text", "Fees / Expense Notes"),
      f("tax / account notes", "taxAccountNotes", "text", "Tax / Account Notes"),
      f("benchmark", "benchmark", "text", "Benchmark"),
      f("current metric", "currentMetric", "text", "Current Metric", { authority: "appToSheet" }),
      f("current value", "currentValue", "number", "Current Value", { authority: "appToSheet" }),
      f("observation date", "observationDate", "date", "Observation Date", { authority: "appToSheet" }),
      f("data source", "dataSource", "text", "Data Source", { authority: "appToSheet" }),
      f("ytd %", "ytdPct", "number", "YTD %", { authority: "appToSheet" }),
      f("1y %", "oneYearPct", "number", "1Y %", { authority: "appToSheet" }),
      f("5y annualized %", "fiveYearAnnualizedPct", "number", "5Y Annualized %", { authority: "appToSheet" }),
      f("interest 1-5", "personalInterest", "number", "Interest 1–5"),
      f("understanding 1-5", "personalUnderstanding", "number", "Understanding 1–5"),
      f("risk comfort 1-5", "riskComfort", "number", "Risk Comfort 1–5"),
      f("research status", "researchStatus", "text", "Research Status"),
      f("first experiment", "firstExperiment", "text", "First Experiment"),
      f("notes", "notes", "text", "Notes"),
      f("last reviewed", "lastReviewed", "date", "Last Reviewed"),
    ],
  },
  investmentExperiments: {
    key: "investmentExperiments", label: "Investment Experiments", workbook: "long", entity: "investmentExperiment", titleField: "name",
    fields: [
      f("investment sync id", "investmentSyncId", "text", "Investment Sync ID", { authority: "appToSheet" }),
      f("investment", "investmentLabel", "text", "Investment"),
      f("experiment", "name", "text", "Experiment"),
      f("mode", "mode", "text", "Mode"),
      f("status", "status", "text", "Status"),
      f("hypothesis", "hypothesis", "text", "Hypothesis"),
      f("benchmark", "benchmark", "text", "Benchmark"),
      f("start date", "startDate", "date", "Start Date"),
      f("review date", "reviewDate", "date", "Review Date"),
      f("starting amount", "startingAmount", "number", "Starting Amount"),
      f("recurring contribution", "recurringContribution", "number", "Recurring Contribution"),
      f("start price / level", "startPrice", "number", "Start Price / Level"),
      f("current price / level", "currentPrice", "number", "Current Price / Level", { authority: "appToSheet" }),
      f("current value", "currentValue", "number", "Current Value", { authority: "appToSheet" }),
      f("return $", "returnDollars", "number", "Return $", { authority: "appToSheet" }),
      f("return %", "returnPct", "number", "Return %", { authority: "appToSheet" }),
      f("fees", "fees", "number", "Fees"),
      f("learning", "learning", "text", "Learning"),
      f("decision", "finalDecision", "text", "Decision"),
      f("data source", "dataSource", "text", "Data Source", { authority: "appToSheet" }),
      f("last refreshed", "lastRefreshed", "date", "Last Refreshed", { authority: "appToSheet" }),
    ],
  },
};

export const TAB_ORDER: TabKey[] = ["shortIdeas", "longIdeas", "experiments", "sprint", "plan", "costs", "investments", "investmentExperiments"];

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
