import {
  effortAverage, isPassive, money, moneyRange, num, passiveGroup, shortScore, startupMax, type Assumption, type Idea,
} from "@/lib/domain";
import type { Actuals } from "./derive";
import type { CardMetric, Column, FilterDef, SortDef } from "./idea-views";
import { StatusPill } from "./ui";

const score = (v: number | null) => (v === null ? "—" : `${v}/5`);

export function validationStatus(assumptions: Assumption[] | undefined) {
  if (!assumptions?.length) return "Not Started";
  if (assumptions.some(a => a.status === "Validated")) return "Validated";
  if (assumptions.some(a => a.status === "Evidence Against")) return "Evidence Against";
  if (assumptions.some(a => a.status === "Evidence Supports")) return "Evidence Supports";
  return "Researching";
}

export const SORTS = {
  score: { key: "score", label: "Score", value: (i: Idea) => shortScore(i) ?? i.sheetFitScore, dir: -1 } as SortDef,
  fit: { key: "fit", label: "Fit Score", value: (i: Idea) => i.sheetFitScore, dir: -1 } as SortDef,
  potential: { key: "potential", label: "Monthly Potential", value: (i: Idea) => i.monthlyHigh, dir: -1 } as SortDef,
  startup: { key: "startup", label: "Startup Cost (Low First)", value: startupMax, dir: 1 } as SortDef,
  speed: { key: "speed", label: "Speed to Cash", value: (i: Idea) => i.speed ?? (i.weeksToFirst !== null ? 6 - Math.min(5, i.weeksToFirst / 4) : null), dir: -1 } as SortDef,
  weeks: { key: "weeks", label: "Weeks to First $", value: (i: Idea) => i.weeksToFirst, dir: 1 } as SortDef,
  passive: { key: "passive", label: "Passive Potential", value: (i: Idea) => i.passivePotential, dir: -1 } as SortDef,
  maintenance: { key: "maintenance", label: "Lightest Maintenance", value: (i: Idea) => i.ongoingEffort, dir: 1 } as SortDef,
  recent: { key: "recent", label: "Recently Updated", value: (i: Idea) => i.updatedAt, dir: -1 } as SortDef,
  name: { key: "name", label: "Name", value: (i: Idea) => i.title, dir: 1 } as SortDef,
};

export const FILTERS = {
  status: { key: "status", label: "Status", kind: "choice", get: (i: Idea) => i.status } as FilterDef,
  category: { key: "category", label: "Category", kind: "choice", get: (i: Idea) => i.category } as FilterDef,
  tier: { key: "tier", label: "Tier", kind: "choice", get: (i: Idea) => i.tier } as FilterDef,
  horizon: { key: "horizon", label: "Horizon", kind: "choice", get: (i: Idea) => i.horizon, options: ["Short Term", "Long Term", "Both"] } as FilterDef,
  style: { key: "style", label: "Income Style", kind: "choice", get: (i: Idea) => i.incomeStyle, options: ["Active", "Hybrid", "Passive-ish"] } as FilterDef,
  type: { key: "type", label: "Opportunity Type", kind: "choice", get: (i: Idea) => i.opportunityType } as FilterDef,
  stage: { key: "stage", label: "Research Stage", kind: "choice", get: (i: Idea) => i.stage, options: ["Discover", "Validate", "Build", "Launch", "Scale"] } as FilterDef,
  group: { key: "group", label: "Asset Group", kind: "choice", get: (i: Idea) => passiveGroup(i) } as FilterDef,
  startupMax: { key: "startupMax", label: "Startup Cost Up To ($)", kind: "max", get: startupMax } as FilterDef,
  monthlyMin: { key: "monthlyMin", label: "Monthly Potential At Least ($)", kind: "min", get: (i: Idea) => i.monthlyHigh } as FilterDef,
  speedMin: { key: "speedMin", label: "Speed At Least (1–5)", kind: "min", get: (i: Idea) => i.speed } as FilterDef,
  fitMin: { key: "fitMin", label: "Fit At Least (1–5)", kind: "min", get: (i: Idea) => i.fit } as FilterDef,
  demandMin: { key: "demandMin", label: "Demand At Least (1–5)", kind: "min", get: (i: Idea) => i.demand } as FilterDef,
  weeksMax: { key: "weeksMax", label: "Weeks to First $ Up To", kind: "max", get: (i: Idea) => i.weeksToFirst } as FilterDef,
  skillMin: { key: "skillMin", label: "Skill Fit At Least (1–5)", kind: "min", get: (i: Idea) => i.skillFit } as FilterDef,
  interestMin: { key: "interestMin", label: "Interest At Least (1–5)", kind: "min", get: (i: Idea) => i.interest } as FilterDef,
  passiveMin: { key: "passiveMin", label: "Passive Potential At Least (1–5)", kind: "min", get: (i: Idea) => i.passivePotential } as FilterDef,
  effortMax: { key: "effortMax", label: "Overall Effort Up To (1–5)", kind: "max", get: effortAverage } as FilterDef,
  maintenanceMax: { key: "maintenanceMax", label: "Ongoing Effort Up To (1–5)", kind: "max", get: (i: Idea) => i.ongoingEffort } as FilterDef,
  fitScoreMin: { key: "fitScoreMin", label: "Fit Score At Least (/100)", kind: "min", get: (i: Idea) => i.sheetFitScore } as FilterDef,
};

export function activeExperimentFilter(actuals: Map<string, Actuals>): FilterDef {
  return { key: "active", label: "Has a Running Experiment", kind: "toggle", get: i => (actuals.get(i.id)?.running ?? 0) > 0 };
}

export function validationFilter(byIdea: Map<string, Assumption[]>): FilterDef {
  return {
    key: "validation", label: "Validation Status", kind: "choice", get: i => validationStatus(byIdea.get(i.id)),
    options: ["Not Started", "Researching", "Evidence Supports", "Evidence Against", "Validated"],
  };
}

const statusCol: Column = { key: "status", label: "Status", value: i => i.status, render: i => <StatusPill status={i.status} /> };

export const SHORT_COLUMNS: Column[] = [
  statusCol,
  { key: "tier", label: "Tier", value: i => i.tier },
  { key: "firstCash", label: "First Cash", value: i => i.firstCash },
  { key: "startup", label: "Startup", value: startupMax, render: i => money(startupMax(i)), numeric: true },
  { key: "hours", label: "Weekly Hrs", value: i => i.weeklyHours, numeric: true },
  { key: "monthly", label: "Monthly Range", value: i => i.monthlyHigh, render: i => moneyRange(i.monthlyLow, i.monthlyHigh), numeric: true },
  { key: "speed", label: "Speed", value: i => i.speed, render: i => score(i.speed), numeric: true },
  { key: "fit", label: "Fit", value: i => i.fit, render: i => score(i.fit), numeric: true },
  { key: "demand", label: "Demand", value: i => i.demand, render: i => score(i.demand), numeric: true },
  { key: "scale", label: "Scale", value: i => i.scale, render: i => score(i.scale), numeric: true },
  { key: "lowCost", label: "Low Cost", value: i => i.lowCost, render: i => score(i.lowCost), numeric: true },
  { key: "lowRisk", label: "Low Risk", value: i => i.lowRisk, render: i => score(i.lowRisk), numeric: true },
  { key: "score", label: "Score /100", value: shortScore, numeric: true },
];

export const LONG_COLUMNS: Column[] = [
  statusCol,
  { key: "stage", label: "Stage", value: i => i.stage },
  { key: "startup", label: "Startup", value: startupMax, render: i => moneyRange(i.startupLow, i.startupHigh, true), numeric: true },
  { key: "monthlyCost", label: "Monthly Cost", value: i => i.monthlyCost, render: i => money(i.monthlyCost), numeric: true },
  { key: "weeks", label: "Weeks to $", value: i => i.weeksToFirst, numeric: true },
  { key: "income", label: "Income Potential", value: i => i.monthlyHigh, render: i => moneyRange(i.monthlyLow, i.monthlyHigh, true), numeric: true },
  { key: "skillFit", label: "Skill Fit", value: i => i.skillFit, render: i => score(i.skillFit), numeric: true },
  { key: "interest", label: "Interest", value: i => i.interest, render: i => score(i.interest), numeric: true },
  { key: "passive", label: "Passive", value: i => i.passivePotential, render: i => score(i.passivePotential), numeric: true },
  { key: "setup", label: "Setup", value: i => i.setupEffort, render: i => score(i.setupEffort), numeric: true },
  { key: "ongoing", label: "Ongoing", value: i => i.ongoingEffort, render: i => score(i.ongoingEffort), numeric: true },
  { key: "sales", label: "Sales", value: i => i.salesEffort, render: i => score(i.salesEffort), numeric: true },
  { key: "complexity", label: "Complexity", value: i => i.complexity, render: i => score(i.complexity), numeric: true },
  { key: "effort", label: "Effort", value: effortAverage, render: i => num(effortAverage(i)), numeric: true },
  { key: "fitScore", label: "Fit /100", value: i => i.sheetFitScore, numeric: true },
];

export const MIXED_COLUMNS: Column[] = [
  statusCol,
  { key: "horizon", label: "Horizon", value: i => i.horizon },
  { key: "style", label: "Style", value: i => i.incomeStyle },
  { key: "type", label: "Type", value: i => i.opportunityType },
  { key: "stage", label: "Stage", value: i => i.stage },
  { key: "startup", label: "Startup", value: startupMax, render: i => moneyRange(i.startupLow, i.startupHigh, true), numeric: true },
  { key: "income", label: "Income Potential", value: i => i.monthlyHigh, render: i => moneyRange(i.monthlyLow, i.monthlyHigh, true), numeric: true },
  { key: "score", label: "Score", value: i => shortScore(i) ?? i.sheetFitScore, numeric: true },
];

export function passiveColumns(actuals: Map<string, Actuals>): Column[] {
  return [
    { key: "group", label: "Group", value: passiveGroup },
    { key: "setup", label: "Build Effort", value: i => i.setupEffort, render: i => score(i.setupEffort), numeric: true },
    { key: "ongoing", label: "Maintenance", value: i => i.ongoingEffort, render: i => score(i.ongoingEffort), numeric: true },
    { key: "maintHours", label: "Maint. Hrs/Wk", value: i => i.maintenanceHours, numeric: true },
    { key: "startup", label: "Startup", value: startupMax, render: i => moneyRange(i.startupLow, i.startupHigh, true), numeric: true },
    { key: "weeks", label: "Time to First $", value: i => i.weeksToFirst, render: i => (i.weeksToFirst !== null ? `${i.weeksToFirst} wks` : i.firstCash || "—") },
    { key: "scale", label: "Scalability", value: i => i.scale, render: i => score(i.scale), numeric: true },
    { key: "passive", label: "Passive", value: i => i.passivePotential, render: i => score(i.passivePotential), numeric: true },
    { key: "income", label: "Monthly Revenue", value: i => i.monthlyHigh, render: i => moneyRange(i.monthlyLow, i.monthlyHigh, true), numeric: true },
    { key: "perHour", label: "$ / Maint. Hr", value: i => incomePerMaintenanceHour(i, actuals.get(i.id)), render: i => money(incomePerMaintenanceHour(i, actuals.get(i.id))), numeric: true },
  ];
}

/** Actual monthly income ÷ monthly maintenance hours. Only shown when both exist. */
export function incomePerMaintenanceHour(idea: Idea, actuals: Actuals | undefined) {
  if (!actuals || actuals.revenue <= 0 || !idea.maintenanceHours) return null;
  return actuals.revenue / (idea.maintenanceHours * 4.33);
}

export const SHORT_METRICS: CardMetric[] = [
  { label: "Startup", value: i => money(startupMax(i)) },
  { label: "First Cash", value: i => i.firstCash || "—" },
  { label: "Score", value: i => (shortScore(i) !== null ? `${shortScore(i)}/100` : "—") },
];

export const LONG_METRICS: CardMetric[] = [
  { label: "Startup", value: i => moneyRange(i.startupLow, i.startupHigh, true) },
  { label: "Income Potential", value: i => moneyRange(i.monthlyLow, i.monthlyHigh, true) },
  { label: "Fit Score", value: i => (i.sheetFitScore !== null ? `${i.sheetFitScore}/100` : "—") },
];

export const PASSIVE_METRICS: CardMetric[] = [
  { label: "Build Effort", value: i => score(i.setupEffort) },
  { label: "Maintenance", value: i => (i.maintenanceHours ? `${i.maintenanceHours} hrs/wk` : score(i.ongoingEffort)) },
  { label: "Monthly Revenue", value: i => moneyRange(i.monthlyLow, i.monthlyHigh, true) },
];

export const passiveIdeas = (ideas: Idea[]) => ideas.filter(isPassive);
