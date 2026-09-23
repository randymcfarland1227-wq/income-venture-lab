import type { TabKey } from "./sync/tabs";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const HORIZONS = ["Short Term", "Long Term", "Both"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const INCOME_STYLES = ["Active", "Hybrid", "Passive-ish"] as const;
export type IncomeStyle = (typeof INCOME_STYLES)[number];

export const OPPORTUNITY_TYPES = [
  "Employment / Bridge Income", "Freelance", "Service Business", "Ecommerce", "Reselling",
  "Digital Product", "Consumer Product", "Technology Product", "Company Concept", "Content", "Software",
  "Asset", "Property", "Investment", "Acquisition", "Other",
] as const;

export const VENTURE_TRACKS = ["Venture Studio", "Idea Vault"] as const;
export type VentureTrack = (typeof VENTURE_TRACKS)[number];

export const STAGES = ["Discover", "Validate", "Build", "Launch", "Scale"] as const;
export const STATUS_SUGGESTIONS = [
  "Exploring", "Shortlist", "Consider", "Research", "Testing", "Validated", "Building", "Earning", "Paused", "Avoid for now",
];
export const EXPERIMENT_STATUSES = ["Planned", "Running", "Complete", "Paused", "Stopped"];
export const DECISIONS = ["Scale", "Test Again", "Modify", "Pause", "Stop"];
export const ASSUMPTION_STATUSES = ["Unknown", "Researching", "Evidence Supports", "Evidence Against", "Validated"];
export const CONFIDENCE = ["Low", "Medium", "High"];
export const RESEARCH_KINDS = ["Note", "Observation", "Question", "Link", "Document"];
export const MILESTONE_STATUSES = ["Not Started", "In Progress", "Done", "Blocked"];
export const COST_TYPES = ["One-time", "Monthly"];

export const INVESTMENT_STATUSES = ["Learn", "Considering", "Researching", "Watch", "Paper Trial", "Own", "Paused", "Avoid", "Archived"] as const;
export const INVESTMENT_EXPERIMENT_STATUSES = ["Planned", "Running", "Reviewing", "Complete", "Paused"] as const;
export const INVESTMENT_MODULES = [
  { key: "overview", label: "Overview" }, { key: "how", label: "How It Works" },
  { key: "risk", label: "Risk" }, { key: "performance", label: "Performance & Data" },
  { key: "costs", label: "Costs & Taxes" }, { key: "research", label: "Research" },
  { key: "experiments", label: "Experiments" }, { key: "notes", label: "Notes" },
] as const;

export const BARRIER_TYPES = [
  { key: "capital", label: "Capital" },
  { key: "knowledge", label: "Knowledge / Skill" },
  { key: "regulatory", label: "Regulatory" },
  { key: "acquisition", label: "Customer Acquisition" },
  { key: "competition", label: "Competition" },
  { key: "operational", label: "Operational" },
  { key: "time", label: "Time" },
] as const;

export const MODULES = [
  { key: "overview", label: "Overview" },
  { key: "plan", label: "Business Plan" },
  { key: "brand", label: "Brand" },
  { key: "marketing", label: "Marketing" },
  { key: "market", label: "Market" },
  { key: "competition", label: "Competition" },
  { key: "model", label: "Business Model" },
  { key: "build", label: "Build & Maintenance" },
  { key: "financials", label: "Financials" },
  { key: "barriers", label: "Barriers" },
  { key: "validation", label: "Validation" },
  { key: "experiments", label: "Experiments" },
  { key: "research", label: "Research" },
  { key: "roadmap", label: "Roadmap" },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];

export const PASSIVE_GROUPS = [
  "Digital Assets", "Content / Audience Assets", "Software", "Physical Assets", "Property", "Capital / Investments", "Other Passive-ish",
] as const;

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type IdeaDetails = {
  thesis?: string; customer?: string; problem?: string; whyInterested?: string;
  targetCustomers?: string; segments?: string; geography?: string; customerNeeds?: string;
  marketSize?: string; pricingNotes?: string; demandIndicators?: string; trends?: string; marketQuestions?: string;
  differentiation?: string;
  revenueStreams?: string; pricingModel?: string; acquisition?: string; delivery?: string;
  recurring?: string; keyResources?: string; keyActivities?: string; partners?: string;
  barrierSummary?: string;
  distribution?: string; automation?: string; maintenancePlan?: string; buildPlan?: string;
  businessSummary?: string; mission?: string; vision?: string; offer?: string; advantage?: string;
  operationsPlan?: string; nearTermGoals?: string; openDecisions?: string;
  brandPositioning?: string; brandPromise?: string; brandStory?: string; brandPersonality?: string;
  brandVoice?: string; visualDirection?: string; namingNotes?: string; packagingNotes?: string;
  primaryAudience?: string; marketingObjectives?: string; channelStrategy?: string; contentPillars?: string;
  launchPlan?: string; campaignIdeas?: string; partnershipsPlan?: string; marketingMetrics?: string;
  /** Newline-separated high-level steps to make a business/brand idea real. */
  achievementSteps?: string;
  modules?: ModuleKey[];
};

export const DEFAULT_ACHIEVEMENT_STEPS = [
  "Clarify offer and customer",
  "Validate demand with a small test",
  "Set up delivery / operations basics",
  "Land first paying customers",
  "Systemize and decide scale vs pause",
].join("\n");

type Stamped = { createdAt: string; updatedAt: string; deletedAt: string | null };
type Num = number | null;

export type Idea = Stamped & {
  id: string; syncId: string; title: string; description: string;
  horizon: Horizon; incomeStyle: IncomeStyle; opportunityType: string; category: string;
  status: string; stage: string; tier: string; sheetRef: Num; ventureTrack: VentureTrack | null;
  personalFitAngle: string; howItEarns: string; incomeModel: string; firstCash: string; weeksToFirst: Num;
  startupLow: Num; startupHigh: Num; monthlyCost: Num; weeklyHours: Num; monthlyLow: Num; monthlyHigh: Num;
  maintenanceHours: Num;
  speed: Num; fit: Num; demand: Num; scale: Num; lowCost: Num; lowRisk: Num;
  skillFit: Num; interest: Num; riskComfort: Num; passivePotential: Num;
  setupEffort: Num; ongoingEffort: Num; salesEffort: Num; complexity: Num;
  overallEffort: Num; sheetShortScore: Num; sheetFitScore: Num;
  firstTest: string; notes: string; details: IdeaDetails;
  strategicRole?: string; year1?: string; year3?: string; year5?: string; year10?: string;
  durableAdvantage?: string; dependencies?: string; successMeasure?: string;
  source: string; sourceWorkbook: string | null; sourceSheet: string | null; sourceRow: Num; importedAt: string | null;
};

export type Experiment = Stamped & {
  id: string; syncId: string; ideaId: string | null; ideaLabel: string; name: string; status: string;
  startDate: string | null; decisionDate: string | null; hypothesis: string; testAction: string;
  budget: Num; timeBudget: Num; actualHours: Num; leads: Num; replies: Num; sales: Num;
  revenue: Num; directCosts: Num; sheetNetCash: Num; sheetNetHourly: Num;
  successSignal: string; result: string; learning: string; finalDecision: string; assumptionId: string | null;
  source: string;
};

export type SprintAction = Stamped & {
  id: string; syncId: string; ideaId: string | null; day: string; status: string; action: string;
  deliverable: string; time: string; costCap: Num; successSignal: string; resultNotes: string; source: string;
};

export type ResearchItem = Stamped & {
  id: string; ideaId: string | null; investmentId?: string | null; area: "Market" | "General" | "Investing"; kind: string; title: string; body: string;
  sourceUrl: string; date: string | null; confidence: string; tags: string[];
};

export type Competitor = Stamped & {
  id: string; ideaId: string; name: string; url: string; location: string; category: string;
  targetCustomer: string; pricing: string; positioning: string; strengths: string; weaknesses: string;
  features: string; notes: string;
};

export type Assumption = Stamped & {
  id: string; ideaId: string; assumption: string; status: string; evidence: string;
};

export type Barrier = Stamped & {
  id: string; ideaId: string; type: string; rating: Num; explanation: string; mitigation: string;
};

export type Milestone = Stamped & {
  id: string; syncId: string; ideaId: string | null; ideaLabel: string; month: Num; title: string; stage: string;
  targetDate: string | null; status: string; spendingCap: Num; timeBudget: Num; targetIncome: Num;
  actualIncome: Num; nextAction: string; evidenceNotes: string; source: string;
};

export type Expense = Stamped & {
  id: string; syncId: string; ideaId: string | null; ideaLabel: string; category: string; costType: string;
  item: string; low: Num; high: Num; actual: Num; essential: string; dueDate: string | null; notes: string;
  source: string;
};

export type Finding = Stamped & {
  id: string; ideaId: string | null; investmentId?: string | null; scope: string; title: string; body: string; evidence: string;
  confidence: string; cites: string[];
};

export type InvestmentRiskProfile = Record<
  "market" | "principal" | "credit" | "interestRate" | "inflation" | "liquidity" | "concentration" | "regulatory" | "complexity",
  { level: "Low" | "Moderate" | "High" | "Varies"; explanation: string }
>;

export type InvestmentOption = Stamped & {
  id: string; syncId: string; name: string; classification: string; category: string;
  accountOrAsset: "Account" | "Asset" | "Fund" | "Security" | "Benchmark" | "Cash product" | "Other";
  symbol: string; benchmark: string; definition: string; returnMechanism: string; horizon: string; liquidity: string;
  incomeFrequency: string; passiveLevel: string; status: string; personalInterest: Num; personalUnderstanding: Num;
  riskComfort: Num; liquidityFit: Num; longTermFit: Num; researchStatus: string; firstExperiment: string;
  minimumAccessNotes: string; feesExpenseNotes: string; taxAccountNotes: string; diversification: string;
  incomeGeneration: string; notes: string; lastReviewed: string | null; sourceName: string; sourceUrl: string;
  currentMetric: string; currentValue: Num; observationDate: string | null; dataSource: string;
  ytdPct: Num; oneYearPct: Num; fiveYearAnnualizedPct: Num; riskProfile: InvestmentRiskProfile;
  source: string;
};

export type InvestmentMetric = {
  id: string; investmentId: string; metric: string; value: number; unit: string; observationDate: string;
  fetchedAt: string; provider: string; sourceName: string; sourceUrl: string; methodology: string;
  isDelayed: boolean; isStale: boolean;
};

export type InvestmentExperiment = Stamped & {
  id: string; syncId: string; investmentId: string | null; investmentLabel: string; name: string;
  mode: "Paper" | "Actual"; status: string; hypothesis: string; benchmark: string;
  startDate: string | null; reviewDate: string | null; startingAmount: Num; recurringContribution: Num;
  startPrice: Num; currentPrice: Num; currentValue: Num; returnDollars: Num; returnPct: Num;
  fees: Num; distributions: Num; notes: string; learning: string; finalDecision: string;
  dataSource: string; lastRefreshed: string | null; source: string;
};

export type InvestmentSource = {
  provider: string; status: string; lastAttemptAt: string | null; lastSuccessAt: string | null;
  lastError: string | null; staleAfterMinutes: number; sourceUrl: string;
};

export type InvestmentRule = {
  id: string; investmentId: string; ruleKey: string; ruleYear: number; value: string; unit: string;
  summary: string; sourceName: string; sourceUrl: string; observationDate: string; fetchedAt: string;
};

export type ScenarioKey = "conservative" | "expected" | "strong";
export type FinancialModel = {
  ideaId: string; unitLabel: string; unitPrice: Num; variableCostPerUnit: Num; variableCostPct: Num;
  fixedMonthly: Num; startupCost: Num;
  scenarios: Record<ScenarioKey, { units: Num; revenue: Num }>;
  notes: string; updatedAt: string;
};

export type HistoryEntry = {
  id: string; ideaId: string | null; entityType: string; entityId: string; kind: string; summary: string; at: string;
};

export type SyncEvent = {
  id: string; at: string; direction: string; tab: string; entityType: string; syncId: string;
  action: string; status: string; details: string;
};

export type SyncConflict = {
  id: string; tab: TabKey | "guardrails"; entityType: string; entityId: string; syncId: string;
  field: string; header: string; label: string; title: string;
  siteValue: string; sheetValue: string; baseValue: string;
  status: string; resolution: string | null; createdAt: string; resolvedAt: string | null;
};

export type SyncHealth = "not_configured" | "needs_authorization" | "synced" | "syncing" | "issue" | "conflict";

export type SyncSummary = {
  configured: boolean;
  health: SyncHealth;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  openConflicts: number;
  editorUrl: string | null;
  sheets: Partial<Record<TabKey | "guardrails", { sheetName: string; gid: number }>>;
};

export type AppState = {
  ideas: Idea[];
  experiments: Experiment[];
  sprint: SprintAction[];
  research: ResearchItem[];
  competitors: Competitor[];
  assumptions: Assumption[];
  barriers: Barrier[];
  milestones: Milestone[];
  expenses: Expense[];
  findings: Finding[];
  investments: InvestmentOption[];
  investmentMetrics: InvestmentMetric[];
  investmentExperiments: InvestmentExperiment[];
  investmentSources: InvestmentSource[];
  investmentRules: InvestmentRule[];
  financials: FinancialModel[];
  guardrails: Record<string, string | number | null>;
  history: HistoryEntry[];
  conflicts: SyncConflict[];
  sync: SyncSummary;
  /** Where each synced record currently lives in the Sheets, by sync id. */
  sheetRows: Record<string, Array<{ tab: string; row: number | null }>>;
};

/** Collections that the generic record API can create, update and delete. */
export type Collection =
  | "ideas" | "experiments" | "sprint" | "research" | "competitors" | "assumptions"
  | "barriers" | "milestones" | "expenses" | "findings" | "investments" | "investmentExperiments";

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export const includesShort = (h: string) => h === "Short Term" || h === "Both";
export const includesLong = (h: string) => h === "Long Term" || h === "Both";

const VENTURE_TYPES = new Set([
  "Service Business", "Ecommerce", "Reselling", "Digital Product", "Consumer Product", "Technology Product", "Company Concept",
  "Content", "Software", "Asset", "Property", "Acquisition",
]);

export const isVenture = (idea: Idea) => VENTURE_TYPES.has(idea.opportunityType);
export const isShortTermNo = (idea: Idea) => includesShort(idea.horizon) && String(idea.status ?? "").trim().toLowerCase() === "no";
export const isPassive = (idea: Idea) => idea.incomeStyle === "Passive-ish" || (idea.passivePotential ?? 0) >= 4;

export function passiveGroup(idea: Idea): (typeof PASSIVE_GROUPS)[number] {
  switch (idea.opportunityType) {
    case "Digital Product": case "Ecommerce": return "Digital Assets";
    case "Content": return "Content / Audience Assets";
    case "Software": return "Software";
    case "Asset": case "Reselling": return "Physical Assets";
    case "Property": return "Property";
    case "Investment": return "Capital / Investments";
    default: return "Other Passive-ish";
  }
}

const TITLE_TYPES: Array<[RegExp, string]> = [
  [/amazon fba|private label|print-on-demand|online store/i, "Ecommerce"],
  [/vending|equipment rental|rent equipment|car sharing|parking|storage/i, "Asset"],
  [/franchise|existing business/i, "Acquisition"],
  [/crypto|dividend|treasury|portfolio|savings/i, "Investment"],
  [/mlm|recruitment-led/i, "Other"],
  [/rental property/i, "Property"],
];

const CATEGORY_TYPES: Record<string, string> = {
  "sell what you own": "Reselling", "technical service": "Service Business", "marketing service": "Service Business",
  "freelance": "Freelance", "reselling": "Reselling", "local service": "Service Business", "digital product": "Digital Product",
  "creator service": "Freelance", "ecommerce": "Ecommerce", "e-commerce": "Ecommerce", "content": "Content", "creator": "Content",
  "rental/assets": "Asset", "assets": "Asset", "administrative service": "Service Business", "research service": "Service Business",
  "bridge work": "Employment / Bridge Income", "bridge income": "Employment / Bridge Income", "microbusiness": "Service Business",
  "passive-ish": "Investment", "consulting": "Service Business", "teaching": "Service Business",
  "service business": "Service Business", "software": "Software", "property": "Property", "investing": "Investment",
  "acquisition": "Acquisition",
};

export function inferOpportunityType(category: string, title: string) {
  for (const [pattern, type] of TITLE_TYPES) if (pattern.test(title)) return type;
  return CATEGORY_TYPES[category.trim().toLowerCase()] ?? "Other";
}

export function inferShortIncomeStyle(category: string): IncomeStyle {
  const c = category.trim().toLowerCase();
  if (c === "passive-ish") return "Passive-ish";
  if (c === "digital product" || c === "rental/assets") return "Hybrid";
  return "Active";
}

export function defaultModules(idea: Idea): ModuleKey[] {
  if (idea.details.modules?.length) return idea.details.modules;
  if (idea.ventureTrack === "Venture Studio") {
    return ["overview", "plan", "brand", "marketing", "market", "competition", "model", "financials", "roadmap", "research"];
  }
  if (idea.ventureTrack === "Idea Vault") {
    return ["overview", "plan", "market", "research"];
  }
  if (isPassive(idea)) {
    return ["overview", "market", "build", "financials", "validation", "experiments", "research", "competition", "roadmap"];
  }
  if (isVenture(idea) || idea.horizon !== "Short Term") {
    return ["overview", "market", "competition", "model", "financials", "barriers", "validation", "experiments", "research", "roadmap"];
  }
  return ["overview", "experiments", "financials", "research"];
}

// ---------------------------------------------------------------------------
// Scoring — dimensions stay visible; a score only assists judgment.
// ---------------------------------------------------------------------------

export const SHORT_DIMENSIONS = [
  { field: "speed", label: "Speed" }, { field: "fit", label: "Fit" }, { field: "demand", label: "Demand" },
  { field: "scale", label: "Scalability" }, { field: "lowCost", label: "Startup Affordability" }, { field: "lowRisk", label: "Low Risk" },
] as const;

export const LONG_DIMENSIONS = [
  { field: "skillFit", label: "Skill Fit", invert: false }, { field: "interest", label: "Interest", invert: false },
  { field: "riskComfort", label: "Risk Comfort", invert: false }, { field: "passivePotential", label: "Passive Potential", invert: false },
  { field: "setupEffort", label: "Setup Effort", invert: true }, { field: "ongoingEffort", label: "Ongoing Effort", invert: true },
  { field: "salesEffort", label: "Sales Effort", invert: true }, { field: "complexity", label: "Complexity", invert: true },
] as const;

/** (sum of six 1–5 inputs) ÷ 30 × 100 — the same formula the repaired sheet column uses. */
export function shortScore(idea: Idea): number | null {
  const dims = SHORT_DIMENSIONS.map(d => idea[d.field]);
  if (dims.every(v => typeof v === "number" && v > 0)) {
    return Math.round(((dims as number[]).reduce((a, b) => a + b, 0) / 30) * 100);
  }
  return idea.sheetShortScore ?? null;
}

export function effortAverage(idea: Idea): number | null {
  const values = [idea.setupEffort, idea.ongoingEffort, idea.salesEffort, idea.complexity].filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  if (!values.length) return idea.overallEffort ?? null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function primaryScore(idea: Idea): { label: string; value: number | null } {
  if (includesShort(idea.horizon) && shortScore(idea) !== null) return { label: "Short-Term Score", value: shortScore(idea) };
  return { label: "Fit Score", value: idea.sheetFitScore ?? null };
}

// ---------------------------------------------------------------------------
// Plain-language levels for cards
// ---------------------------------------------------------------------------

export function startupMax(idea: Idea): number | null {
  if (idea.startupLow === null && idea.startupHigh === null) return null;
  return Math.max(idea.startupLow ?? 0, idea.startupHigh ?? 0);
}

export function startupLevel(idea: Idea) {
  const v = startupMax(idea);
  if (v === null) return "Unknown";
  if (v === 0) return "None";
  if (v < 500) return "Low";
  if (v < 5000) return "Moderate";
  if (v < 25000) return "High";
  return "Very High";
}

export function incomeLevel(idea: Idea) {
  const v = idea.monthlyHigh;
  if (v === null) return "Unknown";
  if (v >= 15000) return "Very High";
  if (v >= 5000) return "High";
  if (v >= 1500) return "Moderate";
  return "Modest";
}

export function passiveLevel(idea: Idea) {
  const v = idea.passivePotential;
  if (v === null || v === 0) return idea.incomeStyle === "Passive-ish" ? "Likely" : "—";
  if (v >= 4) return "High";
  if (v === 3) return "Medium";
  return "Low";
}

// ---------------------------------------------------------------------------
// Financial scenarios — directional, never promises.
// ---------------------------------------------------------------------------

export const SCENARIOS: Array<{ key: ScenarioKey; label: string; note: string }> = [
  { key: "conservative", label: "Conservative", note: "Slower demand or harder acquisition" },
  { key: "expected", label: "Expected", note: "Current working assumption" },
  { key: "strong", label: "Strong", note: "Strong execution and demand" },
];

export function defaultFinancialModel(idea: Idea): FinancialModel {
  const low = idea.monthlyLow;
  const high = idea.monthlyHigh;
  const mid = low !== null && high !== null ? Math.round((low + high) / 2) : (low ?? high);
  return {
    ideaId: idea.id, unitLabel: "customer", unitPrice: null, variableCostPerUnit: null, variableCostPct: null,
    fixedMonthly: idea.monthlyCost, startupCost: idea.startupHigh ?? idea.startupLow,
    scenarios: {
      conservative: { units: null, revenue: low },
      expected: { units: null, revenue: mid },
      strong: { units: null, revenue: high },
    },
    notes: "", updatedAt: "",
  };
}

export function scenarioResult(model: FinancialModel, key: ScenarioKey) {
  const s = model.scenarios[key];
  const unitMode = (model.unitPrice ?? 0) > 0 && s.units !== null;
  const revenue = unitMode ? (s.units ?? 0) * (model.unitPrice ?? 0) : (s.revenue ?? 0);
  const variable = unitMode
    ? (s.units ?? 0) * (model.variableCostPerUnit ?? 0)
    : revenue * ((model.variableCostPct ?? 0) / 100);
  const fixed = model.fixedMonthly ?? 0;
  const gross = revenue - variable;
  const operating = gross - fixed;
  const payback = operating > 0 && (model.startupCost ?? 0) > 0 ? (model.startupCost ?? 0) / operating : null;
  return { revenue, variable, fixed, gross, operating, payback, unitMode };
}

export function breakEven(model: FinancialModel): string {
  const fixed = model.fixedMonthly ?? 0;
  if ((model.unitPrice ?? 0) > 0) {
    const margin = (model.unitPrice ?? 0) - (model.variableCostPerUnit ?? 0);
    if (margin <= 0) return "Never — each unit loses money";
    return `${Math.ceil(fixed / margin)} ${model.unitLabel || "unit"}${Math.ceil(fixed / margin) === 1 ? "" : "s"} / month`;
  }
  const pct = (model.variableCostPct ?? 0) / 100;
  if (pct >= 1) return "Never — costs exceed revenue";
  if (!fixed) return "Immediately (no fixed costs entered)";
  return `${money(fixed / (1 - pct))} revenue / month`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function money(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
    notation: compact && Math.abs(value) >= 10000 ? "compact" : "standard",
  }).format(value);
}

export function moneyRange(low: number | null, high: number | null, compact = false) {
  if (low === null && high === null) return "—";
  if (low === null || high === null || low === high) return money(low ?? high, compact);
  return `${money(low, compact)}–${money(high, compact)}`;
}

export function num(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}${suffix}`;
}

const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

export function monthYear(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${AP_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return monthYear(iso);
}

export const normalizeTitle = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
