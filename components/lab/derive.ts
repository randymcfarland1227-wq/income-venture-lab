import type {
  AppState, Assumption, Barrier, Competitor, Experiment, Expense, FinancialModel, Finding, Idea, Milestone, ResearchItem,
} from "@/lib/domain";
import { isShortTermNo } from "@/lib/domain";

export type Actuals = {
  revenue: number;
  costs: number;
  net: number;
  hours: number;
  netPerHour: number | null;
  invested: number;
  running: number;
  hasActuals: boolean;
};

export type Derived = {
  ideas: Idea[];
  archived: Idea[];
  ideaById: Map<string, Idea>;
  experimentsByIdea: Map<string, Experiment[]>;
  researchByIdea: Map<string, ResearchItem[]>;
  competitorsByIdea: Map<string, Competitor[]>;
  assumptionsByIdea: Map<string, Assumption[]>;
  barriersByIdea: Map<string, Barrier[]>;
  milestonesByIdea: Map<string, Milestone[]>;
  expensesByIdea: Map<string, Expense[]>;
  findingsByIdea: Map<string, Finding[]>;
  financialByIdea: Map<string, FinancialModel>;
  actuals: Map<string, Actuals>;
};

function group<T extends { ideaId: string | null }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.ideaId) continue;
    const list = map.get(row.ideaId);
    if (list) list.push(row);
    else map.set(row.ideaId, [row]);
  }
  return map;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function derive(state: AppState | null): Derived {
  const all = state?.ideas ?? [];
  // In the Short-Term workbook, "No" is Randy's decision to exclude an idea
  // from the working Lab. Keep the synced record intact, but do not surface it
  // in site libraries, counts, search, or financial rollups.
  const visible = all.filter(i => !i.deletedAt && !isShortTermNo(i));
  const experimentsByIdea = group(state?.experiments ?? []);
  const milestonesByIdea = group(state?.milestones ?? []);
  const expensesByIdea = group(state?.expenses ?? []);

  const actuals = new Map<string, Actuals>();
  for (const idea of all) {
    const experiments = experimentsByIdea.get(idea.id) ?? [];
    const milestones = milestonesByIdea.get(idea.id) ?? [];
    const expenses = expensesByIdea.get(idea.id) ?? [];
    const revenue = experiments.reduce((a, e) => a + n(e.revenue), 0) + milestones.reduce((a, m) => a + n(m.actualIncome), 0);
    const costs = experiments.reduce((a, e) => a + n(e.directCosts), 0) + expenses.reduce((a, x) => a + n(x.actual), 0);
    const hours = experiments.reduce((a, e) => a + n(e.actualHours), 0);
    const invested = experiments.reduce((a, e) => a + n(e.directCosts || e.budget), 0);
    const net = revenue - costs;
    actuals.set(idea.id, {
      revenue, costs, net, hours, invested,
      netPerHour: hours > 0 ? net / hours : null,
      running: experiments.filter(e => e.status === "Running").length,
      hasActuals: revenue !== 0 || costs !== 0 || hours !== 0,
    });
  }

  return {
    ideas: visible,
    archived: all.filter(i => i.deletedAt),
    ideaById: new Map([...visible, ...all.filter(i => i.deletedAt)].map(i => [i.id, i])),
    experimentsByIdea,
    researchByIdea: group(state?.research ?? []),
    competitorsByIdea: group(state?.competitors ?? []),
    assumptionsByIdea: group(state?.assumptions ?? []),
    barriersByIdea: group(state?.barriers ?? []),
    milestonesByIdea,
    expensesByIdea,
    findingsByIdea: group(state?.findings ?? []),
    financialByIdea: new Map((state?.financials ?? []).map(f => [f.ideaId, f])),
    actuals,
  };
}
