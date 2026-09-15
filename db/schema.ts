import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { IdeaDetails } from "@/lib/domain";

const stamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
};

const str = (name: string) => text(name).notNull().default("");
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// Synced records carry `sync_id` (the identity shared with the Sheet row), `source`
// (sheet / site / snapshot) and where they were first imported from.
const provenance = {
  source: text("source").notNull().default("site"),
  sourceWorkbook: text("source_workbook"),
  sourceSheet: text("source_sheet"),
  sourceRow: integer("source_row"),
  importedAt: text("imported_at"),
};

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  title: text("title").notNull(),
  description: str("description"),
  horizon: text("horizon").notNull(),
  incomeStyle: text("income_style").notNull(),
  opportunityType: text("opportunity_type").notNull().default("Other"),
  category: str("category"),
  status: text("status").notNull().default("Exploring"),
  stage: text("stage").notNull().default("Discover"),
  tier: str("tier"),
  sheetRef: real("sheet_ref"),
  personalFitAngle: str("personal_fit_angle"),
  howItEarns: str("how_it_earns"),
  incomeModel: str("income_model"),
  firstCash: str("first_cash_estimate"),
  weeksToFirst: real("weeks_to_first"),
  startupLow: real("startup_low"),
  startupHigh: real("startup_high"),
  monthlyCost: real("monthly_cost"),
  weeklyHours: real("weekly_hours"),
  monthlyLow: real("monthly_income_low"),
  monthlyHigh: real("monthly_income_high"),
  maintenanceHours: real("maintenance_hours"),
  speed: real("speed_score"),
  fit: real("fit_score"),
  demand: real("demand_score"),
  scale: real("scale_score"),
  lowCost: real("low_cost_score"),
  lowRisk: real("low_risk_score"),
  skillFit: real("skill_fit"),
  interest: real("interest"),
  riskComfort: real("risk_comfort"),
  passivePotential: real("passive_potential"),
  setupEffort: real("setup_effort"),
  ongoingEffort: real("ongoing_effort"),
  salesEffort: real("sales_effort"),
  complexity: real("complexity"),
  overallEffort: real("overall_effort"),
  sheetShortScore: real("sheet_short_score"),
  sheetFitScore: real("sheet_fit_score"),
  firstTest: str("first_test"),
  notes: str("notes"),
  details: json<IdeaDetails>("details").notNull().$defaultFn(() => ({})),
  ...provenance,
  ...stamps,
}, t => [index("ideas_horizon_idx").on(t.horizon), index("ideas_deleted_idx").on(t.deletedAt)]);

export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  ideaId: text("idea_id"),
  ideaLabel: str("idea_label"),
  name: str("name"),
  status: text("status").notNull().default("Planned"),
  startDate: text("start_date"),
  decisionDate: text("decision_date"),
  hypothesis: str("hypothesis"),
  testAction: str("test_action"),
  budget: real("budget"),
  timeBudget: real("time_budget"),
  actualHours: real("actual_hours"),
  leads: real("leads"),
  replies: real("replies"),
  sales: real("sales"),
  revenue: real("revenue"),
  directCosts: real("direct_costs"),
  sheetNetCash: real("sheet_net_cash"),
  sheetNetHourly: real("sheet_net_hourly"),
  successSignal: str("success_signal"),
  result: str("result"),
  learning: str("learning"),
  finalDecision: str("final_decision"),
  assumptionId: text("assumption_id"),
  ...provenance,
  ...stamps,
}, t => [index("experiments_idea_idx").on(t.ideaId)]);

export const sprintActions = sqliteTable("sprint_actions", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  ideaId: text("idea_id"),
  day: str("day"),
  status: str("status"),
  action: str("action"),
  deliverable: str("deliverable"),
  time: str("time"),
  costCap: real("cost_cap"),
  successSignal: str("success_signal"),
  resultNotes: str("result_notes"),
  ...provenance,
  ...stamps,
});

export const research = sqliteTable("research", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id"),
  investmentId: text("investment_id"),
  area: text("area").notNull().default("General"),
  kind: text("kind").notNull().default("Note"),
  title: str("title"),
  body: str("body"),
  sourceUrl: str("source_url"),
  date: text("date"),
  confidence: str("confidence"),
  tags: json<string[]>("tags").notNull().$defaultFn(() => []),
  ...stamps,
}, t => [index("research_idea_idx").on(t.ideaId)]);

export const competitors = sqliteTable("competitors", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id").notNull(),
  name: text("name").notNull(),
  url: str("url"),
  location: str("location"),
  category: str("category"),
  targetCustomer: str("target_customer"),
  pricing: str("pricing"),
  positioning: str("positioning"),
  strengths: str("strengths"),
  weaknesses: str("weaknesses"),
  features: str("features"),
  notes: str("notes"),
  ...stamps,
}, t => [index("competitors_idea_idx").on(t.ideaId)]);

export const assumptions = sqliteTable("validation_assumptions", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id").notNull(),
  assumption: text("assumption").notNull(),
  status: text("status").notNull().default("Unknown"),
  evidence: str("evidence"),
  ...stamps,
});

export const barriers = sqliteTable("barriers", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id").notNull(),
  type: text("type").notNull(),
  rating: real("rating"),
  explanation: str("explanation"),
  mitigation: str("mitigation"),
  ...stamps,
});

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  ideaId: text("idea_id"),
  ideaLabel: str("idea_label"),
  month: real("month"),
  title: str("title"),
  stage: text("stage").notNull().default("Discover"),
  targetDate: text("target_date"),
  status: text("status").notNull().default("Not Started"),
  spendingCap: real("spending_cap"),
  timeBudget: real("time_budget"),
  targetIncome: real("target_income"),
  actualIncome: real("actual_income"),
  nextAction: str("next_action"),
  evidenceNotes: str("evidence_notes"),
  ...provenance,
  ...stamps,
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  ideaId: text("idea_id"),
  ideaLabel: str("idea_label"),
  category: str("category"),
  costType: str("cost_type"),
  item: str("item"),
  low: real("low"),
  high: real("high"),
  actual: real("actual"),
  essential: str("essential"),
  dueDate: text("due_date"),
  notes: str("notes"),
  ...provenance,
  ...stamps,
});

export const findings = sqliteTable("discovery_findings", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id"),
  investmentId: text("investment_id"),
  scope: text("scope").notNull().default("Global"),
  title: text("title").notNull(),
  body: str("body"),
  evidence: str("evidence"),
  confidence: str("confidence"),
  cites: json<string[]>("cites").notNull().$defaultFn(() => []),
  ...stamps,
});

export const financialModels = sqliteTable("financial_assumptions", {
  ideaId: text("idea_id").primaryKey(),
  data: json<Record<string, unknown>>("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const guardrails = sqliteTable("guardrails", {
  key: text("key").primaryKey(),
  value: json<string | number | null>("value"),
  updatedAt: text("updated_at").notNull(),
});

export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  at: text("at").notNull(),
}, t => [index("history_idea_idx").on(t.ideaId), index("history_at_idx").on(t.at)]);

export const investmentOptions = sqliteTable("investment_options", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  name: text("name").notNull(),
  classification: str("classification"),
  category: str("category"),
  accountOrAsset: text("account_or_asset").notNull().default("Asset"),
  symbol: str("symbol"),
  benchmark: str("benchmark"),
  definition: str("definition"),
  returnMechanism: str("return_mechanism"),
  horizon: str("horizon"),
  liquidity: str("liquidity"),
  incomeFrequency: str("income_frequency"),
  passiveLevel: str("passive_level"),
  status: text("status").notNull().default("Learn"),
  personalInterest: real("personal_interest"),
  personalUnderstanding: real("personal_understanding"),
  riskComfort: real("risk_comfort"),
  liquidityFit: real("liquidity_fit"),
  longTermFit: real("long_term_fit"),
  researchStatus: str("research_status"),
  firstExperiment: str("first_experiment"),
  minimumAccessNotes: str("minimum_access_notes"),
  feesExpenseNotes: str("fees_expense_notes"),
  taxAccountNotes: str("tax_account_notes"),
  diversification: str("diversification"),
  incomeGeneration: str("income_generation"),
  notes: str("notes"),
  lastReviewed: text("last_reviewed"),
  sourceName: str("source_name"),
  sourceUrl: str("source_url"),
  currentMetric: str("current_metric"),
  currentValue: real("current_value"),
  observationDate: text("observation_date"),
  dataSource: str("data_source"),
  ytdPct: real("ytd_pct"),
  oneYearPct: real("one_year_pct"),
  fiveYearAnnualizedPct: real("five_year_annualized_pct"),
  riskProfile: json<Record<string, { level: string; explanation: string }>>("risk_profile").notNull().$defaultFn(() => ({})),
  ...provenance,
  ...stamps,
}, t => [
  index("investment_options_category_idx").on(t.category),
  index("investment_options_status_idx").on(t.status),
]);

export const investmentLiveMetrics = sqliteTable("investment_live_metrics", {
  id: text("id").primaryKey(),
  investmentId: text("investment_id").notNull(),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  observationDate: text("observation_date").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  provider: text("provider").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  methodology: text("methodology").notNull(),
  isDelayed: integer("is_delayed", { mode: "boolean" }).notNull().default(false),
  isStale: integer("is_stale", { mode: "boolean" }).notNull().default(false),
}, t => [
  index("investment_metrics_lookup_idx").on(t.investmentId, t.metric, t.observationDate),
  index("investment_metrics_fetched_idx").on(t.fetchedAt),
]);

export const investmentExperiments = sqliteTable("investment_experiments", {
  id: text("id").primaryKey(),
  syncId: text("sync_id").notNull().unique(),
  investmentId: text("investment_id"),
  investmentLabel: str("investment_label"),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("Paper"),
  status: text("status").notNull().default("Planned"),
  hypothesis: str("hypothesis"),
  benchmark: str("benchmark"),
  startDate: text("start_date"),
  reviewDate: text("review_date"),
  startingAmount: real("starting_amount"),
  recurringContribution: real("recurring_contribution"),
  startPrice: real("start_price"),
  currentPrice: real("current_price"),
  currentValue: real("current_value"),
  returnDollars: real("return_dollars"),
  returnPct: real("return_pct"),
  fees: real("fees"),
  distributions: real("distributions"),
  notes: str("notes"),
  learning: str("learning"),
  finalDecision: str("final_decision"),
  dataSource: str("data_source"),
  lastRefreshed: text("last_refreshed"),
  ...provenance,
  ...stamps,
}, t => [index("investment_experiments_investment_idx").on(t.investmentId)]);

export const investmentSources = sqliteTable("investment_sources", {
  provider: text("provider").primaryKey(),
  status: text("status").notNull(),
  lastAttemptAt: text("last_attempt_at"),
  lastSuccessAt: text("last_success_at"),
  lastError: text("last_error"),
  staleAfterMinutes: integer("stale_after_minutes").notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const investmentAccountRules = sqliteTable("investment_account_rules", {
  id: text("id").primaryKey(),
  investmentId: text("investment_id").notNull(),
  ruleKey: text("rule_key").notNull(),
  ruleYear: integer("rule_year").notNull(),
  value: text("value").notNull(),
  unit: text("unit").notNull(),
  summary: text("summary").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  observationDate: text("observation_date").notNull(),
  fetchedAt: text("fetched_at").notNull(),
}, t => [index("investment_rules_lookup_idx").on(t.investmentId, t.ruleYear)]);

/** The last values both sides agreed on, per Sheet representation. Drives 3-way merges. */
export const syncBaselines = sqliteTable("sync_baselines", {
  id: text("id").primaryKey(),
  tab: text("tab").notNull(),
  syncId: text("sync_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  values: json<Record<string, string>>("values").notNull(),
  row: integer("row"),
  syncedAt: text("synced_at").notNull(),
}, t => [index("sync_baselines_entity_idx").on(t.entityId)]);

export const syncEvents = sqliteTable("sync_events", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  direction: text("direction").notNull(),
  tab: str("tab"),
  entityType: str("entity_type"),
  syncId: str("sync_id"),
  action: text("action").notNull(),
  status: text("status").notNull(),
  details: str("details"),
}, t => [index("sync_events_at_idx").on(t.at)]);

export const syncConflicts = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  tab: text("tab").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  syncId: text("sync_id").notNull(),
  field: text("field").notNull(),
  header: text("header").notNull(),
  label: text("label").notNull(),
  title: str("title"),
  siteValue: str("site_value"),
  sheetValue: str("sheet_value"),
  baseValue: str("base_value"),
  status: text("status").notNull().default("Open"),
  resolution: text("resolution"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: json<unknown>("value"),
});
