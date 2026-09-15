import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";
import { BlsCpiProvider } from "./bls";
import { FredSp500Provider } from "./fred";
import { IrsRetirementRulesProvider } from "./irs";
import { TreasuryYieldProvider } from "./treasury";
import { TreasuryDirectSavingsBondProvider } from "./treasurydirect";
import { marketProviderStatus } from "./market-provider";
import type { InvestmentDataProvider, NormalizedMetric, NormalizedRule } from "./types";

const providers: InvestmentDataProvider[] = [
  new FredSp500Provider(), new TreasuryYieldProvider(), new BlsCpiProvider(),
  new TreasuryDirectSavingsBondProvider(), new IrsRetirementRulesProvider(),
];

function stale(last: string | null, minutes: number) {
  return !last || Date.now() - new Date(last).getTime() > minutes * 60_000;
}

async function saveMetric(db: Db, metric: NormalizedMetric) {
  const id = `${metric.provider}:${metric.investmentId}:${metric.metric}:${metric.observationDate}`;
  await db.insert(s.investmentLiveMetrics).values({ id, ...metric }).onConflictDoUpdate({
    target: s.investmentLiveMetrics.id,
    set: { value: metric.value, fetchedAt: metric.fetchedAt, sourceName: metric.sourceName, sourceUrl: metric.sourceUrl,
      methodology: metric.methodology, isDelayed: metric.isDelayed, isStale: metric.isStale },
  });
}

async function saveRule(db: Db, rule: NormalizedRule) {
  const id = `${rule.investmentId}:${rule.ruleKey}:${rule.ruleYear}`;
  await db.insert(s.investmentAccountRules).values({ id, ...rule }).onConflictDoUpdate({
    target: s.investmentAccountRules.id,
    set: { value: rule.value, summary: rule.summary, observationDate: rule.observationDate, fetchedAt: rule.fetchedAt,
      sourceName: rule.sourceName, sourceUrl: rule.sourceUrl },
  });
}

async function updateCurrentOptionData(db: Db) {
  const rows = await db.select().from(s.investmentLiveMetrics).orderBy(desc(s.investmentLiveMetrics.observationDate), desc(s.investmentLiveMetrics.fetchedAt));
  const latest = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!latest.has(`${row.investmentId}:${row.metric}`)) latest.set(`${row.investmentId}:${row.metric}`, row);
  const mappings = [
    ["inv-sp500-benchmark", "level", "S&P 500 price index level"], ["inv-tbill", "3_month_yield", "3-month Treasury yield"],
    ["inv-tnote", "10_year_yield", "10-year Treasury yield"], ["inv-tbond", "30_year_yield", "30-year Treasury yield"],
    ["inv-ibond", "i_bond_composite_rate", "I Bond composite rate"], ["inv-eebond", "ee_bond_rate", "EE Bond rate"],
  ] as const;
  for (const [investmentId, metric, label] of mappings) {
    const row = latest.get(`${investmentId}:${metric}`);
    if (!row) continue;
    const patch: Record<string, unknown> = { currentMetric: label, currentValue: row.value, observationDate: row.observationDate,
      dataSource: row.sourceName, updatedAt: new Date().toISOString() };
    if (investmentId === "inv-sp500-benchmark") {
      patch.ytdPct = latest.get(`${investmentId}:ytd_pct`)?.value ?? null;
      patch.oneYearPct = latest.get(`${investmentId}:one_year_pct`)?.value ?? null;
      patch.fiveYearAnnualizedPct = latest.get(`${investmentId}:five_year_annualized_pct`)?.value ?? null;
    }
    await db.update(s.investmentOptions).set(patch).where(eq(s.investmentOptions.id, investmentId));
  }
}

async function updatePaperTrials(db: Db) {
  const [experiments, options] = await Promise.all([
    db.select().from(s.investmentExperiments).where(eq(s.investmentExperiments.mode, "Paper")),
    db.select().from(s.investmentOptions),
  ]);
  const byId = new Map(options.map(option => [option.id, option]));
  for (const experiment of experiments) {
    const option = experiment.investmentId ? byId.get(experiment.investmentId) : undefined;
    const price = option?.currentValue;
    if (!price || !experiment.startPrice || !experiment.startingAmount) continue;
    const contributions = experiment.recurringContribution && experiment.startDate
      ? Math.max(0, Math.floor((Date.now() - new Date(experiment.startDate).getTime()) / (30.4375 * 86400000))) * experiment.recurringContribution : 0;
    const invested = experiment.startingAmount + contributions;
    const currentValue = (experiment.startingAmount / experiment.startPrice) * price + contributions - (experiment.fees ?? 0) + (experiment.distributions ?? 0);
    await db.update(s.investmentExperiments).set({ currentPrice: price, currentValue,
      returnDollars: currentValue - invested, returnPct: invested ? ((currentValue / invested) - 1) * 100 : null,
      dataSource: option.dataSource, lastRefreshed: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(s.investmentExperiments.id, experiment.id));
  }
}

export async function refreshInvestmentData(db: Db, force = false) {
  const statuses = await db.select().from(s.investmentSources);
  const byProvider = new Map(statuses.map(row => [row.provider, row]));
  const results = await Promise.all(providers.map(async provider => {
    const existing = byProvider.get(provider.name);
    if (!force && existing && !stale(existing.lastSuccessAt, provider.staleAfterMinutes)) return { provider: provider.name, status: "cached" as const };
    const attemptedAt = new Date().toISOString();
    try {
      const result = await provider.fetch();
      for (const metric of result.metrics ?? []) await saveMetric(db, metric);
      for (const rule of result.rules ?? []) await saveRule(db, rule);
      await db.insert(s.investmentSources).values({ provider: provider.name, status: "healthy", lastAttemptAt: attemptedAt,
        lastSuccessAt: attemptedAt, lastError: null, staleAfterMinutes: provider.staleAfterMinutes, sourceUrl: provider.sourceUrl })
        .onConflictDoUpdate({ target: s.investmentSources.provider, set: { status: "healthy", lastAttemptAt: attemptedAt,
          lastSuccessAt: attemptedAt, lastError: null, staleAfterMinutes: provider.staleAfterMinutes, sourceUrl: provider.sourceUrl } });
      return { provider: provider.name, status: "refreshed" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.insert(s.investmentSources).values({ provider: provider.name, status: "error", lastAttemptAt: attemptedAt,
        lastSuccessAt: existing?.lastSuccessAt ?? null, lastError: message, staleAfterMinutes: provider.staleAfterMinutes, sourceUrl: provider.sourceUrl })
        .onConflictDoUpdate({ target: s.investmentSources.provider, set: { status: "error", lastAttemptAt: attemptedAt,
          lastError: message, staleAfterMinutes: provider.staleAfterMinutes, sourceUrl: provider.sourceUrl } });
      return { provider: provider.name, status: "error" as const, error: message };
    }
  }));
  await updateCurrentOptionData(db);
  await updatePaperTrials(db);
  return { results, marketQuoteProvider: marketProviderStatus() };
}

export async function investmentDataState(db: Db) {
  const [metrics, sources, rules] = await Promise.all([
    db.select().from(s.investmentLiveMetrics).orderBy(desc(s.investmentLiveMetrics.observationDate), desc(s.investmentLiveMetrics.fetchedAt)),
    db.select().from(s.investmentSources),
    db.select().from(s.investmentAccountRules).orderBy(desc(s.investmentAccountRules.ruleYear)),
  ]);
  const sourceByProvider = new Map(sources.map(source => [source.provider, source]));
  const markedMetrics = metrics.map(metric => {
    const source = sourceByProvider.get(metric.provider);
    return {
      ...metric,
      // Staleness is evaluated at read time. This lets a last-known-good value
      // age honestly even when its upstream source is currently unavailable.
      isStale: source ? stale(source.lastSuccessAt, source.staleAfterMinutes) : true,
    };
  });
  return { metrics: markedMetrics, sources, rules, marketQuoteProvider: marketProviderStatus() };
}
