"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Calculator, GitCompareArrows, Landmark, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvestmentExperiment, InvestmentMetric, InvestmentOption } from "@/lib/domain";
import { money, shortDate } from "@/lib/domain";
import { FindingList } from "../findings";
import { FORMS } from "../forms";
import { SectionTabs } from "../section-tabs";
import { OpenInSheet } from "../sheet-link";
import { useLab } from "../store";
import { Empty, PageHeader, RecordDialog, SectionHeader, StatusPill, Tag, useRecordDialog } from "../ui";
import { runtimeApi } from "@/lib/client/runtime-api";

type DataState = { metrics: InvestmentMetric[]; marketQuoteProvider: string; refresh?: { results?: Array<{ provider: string; status: string; error?: string }> } };

const tabs: Array<[string, string]> = [
  ["explore", "Explore"], ["considering", "Considering"], ["compare", "Compare"],
  ["experiments", "Experiments"], ["scenario", "Growth Scenario"], ["discovery", "Investing Discovery"],
];

export function InvestingPage({ tab = "explore" }: { tab?: string }) {
  const { state } = useLab();
  const [live, setLive] = useState<DataState>({ metrics: state?.investmentMetrics ?? [], marketQuoteProvider: "Live quote provider not configured" });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async (force = false) => {
    setRefreshing(true);
    try {
      const data = await runtimeApi.investmentData<DataState>(force);
      setLive(data);
    } finally { setRefreshing(false); }
  };
  useEffect(() => {
    let active = true;
    void runtimeApi.investmentData<DataState>()
      .then(data => { if (active) setLive(data); })
      .catch(() => { /* The seeded/cached state remains visible. */ });
    return () => { active = false; };
  }, []);

  const options = (state?.investments ?? []).filter(option => !option.deletedAt);
  return (
    <>
      <PageHeader eyebrow="Education · Research · Experimentation" title="Investing & Assets"
        description="Understand accounts, assets, benchmarks, risk, and real-world data without turning research into a recommendation."
        actions={<><OpenInSheet tab="investments" label="Open Investing Sheet" /><Button variant="outline" className="rounded-full" onClick={() => void refresh(true)} disabled={refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh Data</Button></>} />
      <SectionTabs base="investing" active={tab} tabs={tabs} />
      {tab === "considering" ? <Considering options={options} />
        : tab === "compare" ? <Compare options={options} />
        : tab === "experiments" ? <InvestmentExperiments />
        : tab === "scenario" ? <GrowthScenario />
        : tab === "discovery" ? <InvestingDiscovery />
        : <Explore options={options} live={live} refreshing={refreshing} />}
    </>
  );
}

function latest(metrics: InvestmentMetric[], investmentId: string, metric: string) {
  return metrics.filter(item => item.investmentId === investmentId && item.metric === metric)
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate) || b.fetchedAt.localeCompare(a.fetchedAt))[0];
}

function MarketFact({ label, items, sourceLabel }: { label: string; items: Array<{ name: string; metric?: InvestmentMetric }>; sourceLabel: string }) {
  const available = items.filter(item => item.metric);
  const recent = available.map(item => item.metric as InvestmentMetric).sort((a, b) => b.observationDate.localeCompare(a.observationDate))[0];
  return (
    <article className="market-fact">
      <div className="flex items-start justify-between gap-3"><p className="card-kicker">{label}</p>{recent?.isStale && <Tag className="tone-warn">Stale</Tag>}</div>
      <div className="market-fact-values">
        {items.map(item => <div key={item.name}><span>{item.name}</span><strong>{item.metric ? `${item.metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${item.metric.unit === "percent" ? "%" : ""}` : "Unavailable"}</strong></div>)}
      </div>
      <div className="market-source">{recent ? <><a href={recent.sourceUrl} target="_blank" rel="noreferrer">Source: {recent.sourceName}</a><span>As of {shortDate(recent.observationDate)}</span></> : <span>{sourceLabel} unavailable; no value invented.</span>}</div>
    </article>
  );
}

function Explore({ options, live, refreshing }: { options: InvestmentOption[]; live: DataState; refreshing: boolean }) {
  const sp = latest(live.metrics, "inv-sp500-benchmark", "level");
  const ytd = latest(live.metrics, "inv-sp500-benchmark", "ytd_pct");
  const one = latest(live.metrics, "inv-sp500-benchmark", "one_year_pct");
  const categories = [...new Set(options.map(option => option.category))];
  const { go } = useLab();
  return (
    <div className="grid gap-10">
      <section>
        <SectionHeader eyebrow="Verified Context" title="Market Context" description="Observation dates matter more than appearing live. Cached values remain visible if a source is temporarily unavailable." />
        <div className="market-grid">
          <MarketFact label="S&P 500 Price Index" items={[{ name: "Level", metric: sp }, { name: "YTD price return", metric: ytd }, { name: "1-year price return", metric: one }]} sourceLabel="FRED" />
          <MarketFact label="U.S. Treasury Rates" items={[
            { name: "3 Month", metric: latest(live.metrics, "inv-tbill", "3_month_yield") },
            { name: "1 Year", metric: latest(live.metrics, "inv-tbill", "1_year_yield") },
            { name: "2 Year", metric: latest(live.metrics, "inv-tnote", "2_year_yield") },
            { name: "10 Year", metric: latest(live.metrics, "inv-tnote", "10_year_yield") },
            { name: "30 Year", metric: latest(live.metrics, "inv-tbond", "30_year_yield") },
          ]} sourceLabel="U.S. Treasury" />
          <MarketFact label="Inflation" items={[{ name: "CPI 12-month change", metric: latest(live.metrics, "context-inflation", "cpi_12_month_change") }]} sourceLabel="BLS" />
          <MarketFact label="Savings Bonds" items={[
            { name: "I Bond composite", metric: latest(live.metrics, "inv-ibond", "i_bond_composite_rate") },
            { name: "EE Bond", metric: latest(live.metrics, "inv-eebond", "ee_bond_rate") },
          ]} sourceLabel="TreasuryDirect" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{refreshing ? "Checking authoritative sources…" : live.marketQuoteProvider}. The rest of the library works without a security-quote API.</p>
      </section>

      <section className="concept-lesson">
        <div><span className="concept-type">Benchmark</span><strong>S&amp;P 500</strong><p>A measurement. You cannot purchase the index itself.</p></div>
        <ArrowRight aria-hidden />
        <div><span className="concept-type">Investment product</span><strong>S&amp;P 500 Index Fund</strong><p>An ETF or mutual fund designed to track the benchmark.</p></div>
      </section>

      <section>
        <SectionHeader eyebrow="Starter Library" title="Explore Investments" description="Begin with investment types. Open any card for plain-language mechanics, structured risk, sources, research, and experiments." />
        <div className="investment-groups">
          {categories.map(category => (
            <section key={category} className="investment-group">
              <div className="group-title">{category}<span>{options.filter(option => option.category === category).length}</span></div>
              <div className="investment-card-grid">
                {options.filter(option => option.category === category).map(option => (
                  <button key={option.id} type="button" className="investment-card" onClick={() => go(`investment/${option.id}`)}>
                    <div className="flex items-start justify-between gap-2"><Tag>{option.accountOrAsset}</Tag><StatusPill status={option.status} /></div>
                    <h3>{option.name}</h3><p>{option.definition}</p>
                    <dl><div><dt>Risk profile</dt><dd>{option.riskProfile.market?.level ?? "Varies"}</dd></div><div><dt>Liquidity</dt><dd>{option.liquidity || "Varies"}</dd></div><div><dt>Horizon</dt><dd>{option.horizon || "Varies"}</dd></div></dl>
                    <span className="open-link">Explore <ArrowRight /></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function Considering({ options }: { options: InvestmentOption[] }) {
  const { go } = useLab();
  const shortlisted = options.filter(option => ["Considering", "Researching", "Watch", "Paper Trial", "Own"].includes(option.status));
  return <div><SectionHeader eyebrow="Personal Shortlist" title="Considering" description="This is what you want to investigate—not a recommendation or ranking." />
    {shortlisted.length ? <div className="investment-card-grid">{shortlisted.map(option => <button key={option.id} className="investment-card" onClick={() => go(`investment/${option.id}`)}><div className="flex justify-between gap-2"><Tag>{option.accountOrAsset}</Tag><StatusPill status={option.status} /></div><h3>{option.name}</h3><p>{option.definition}</p><span className="open-link">Continue research <ArrowRight /></span></button>)}</div>
      : <Empty icon={BookOpen} title="Nothing shortlisted yet" text="Change an investment’s status to Considering, Researching, Watch, Paper Trial, or Own." />}</div>;
}

function Compare({ options }: { options: InvestmentOption[] }) {
  const [chosen, setChosen] = useState<string[]>(options.slice(0, 2).map(option => option.id));
  const rows: Array<[string, (option: InvestmentOption) => string]> = [
    ["What it is", o => o.definition], ["Account vs asset", o => o.accountOrAsset], ["Return mechanism", o => o.returnMechanism],
    ["Market risk", o => o.riskProfile.market?.level ?? "Varies"], ["Principal risk", o => o.riskProfile.principal?.level ?? "Varies"],
    ["Liquidity", o => o.liquidity], ["Typical horizon", o => o.horizon], ["Diversification", o => o.diversification],
    ["Income", o => o.incomeFrequency], ["Fees", o => o.feesExpenseNotes], ["Tax considerations", o => o.taxAccountNotes],
    ["Passive nature", o => o.passiveLevel], ["Complexity", o => o.riskProfile.complexity?.level ?? "Varies"], ["Personal status", o => o.status],
  ];
  const selected = chosen.map(id => options.find(option => option.id === id)).filter(Boolean) as InvestmentOption[];
  return <div className="grid gap-5"><SectionHeader eyebrow="2–4 Options" title="Compare Investments" description="Comparison clarifies tradeoffs. It does not name a winner or tell you what to buy." />
    <div className="compare-picker">{options.map(option => <label key={option.id}><input type="checkbox" checked={chosen.includes(option.id)} disabled={!chosen.includes(option.id) && chosen.length >= 4} onChange={e => setChosen(list => e.target.checked ? [...list, option.id] : list.filter(id => id !== option.id))} /> {option.name}</label>)}</div>
    {selected.length >= 2 ? <div className="table-wrap"><table className="lab-table compare-table"><thead><tr><th>Dimension</th>{selected.map(option => <th key={option.id}>{option.name}</th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th>{selected.map(option => <td key={option.id}>{value(option) || "—"}</td>)}</tr>)}</tbody></table></div>
      : <Empty icon={GitCompareArrows} title="Choose at least two" text="Select two to four investment types above." />}</div>;
}

function InvestmentExperiments() {
  const { state, create, update, archive } = useLab();
  const dialog = useRecordDialog<InvestmentExperiment>();
  const experiments = state?.investmentExperiments ?? [];
  return <div className="grid gap-5"><SectionHeader eyebrow="Paper or Actual" title="Investment Experiments" description="Learn by tracking. The Lab never executes a trade." action={<div className="flex gap-2"><OpenInSheet tab="investmentExperiments" /><Button className="rounded-full" onClick={dialog.openNew}><Plus /> New Experiment</Button></div>} />
    {experiments.length ? <div className="experiment-grid">{experiments.map(experiment => <button key={experiment.id} className="panel text-left" onClick={() => dialog.openEdit(experiment)}><div className="flex justify-between"><Tag>{experiment.mode}</Tag><StatusPill status={experiment.status} /></div><h3 className="mt-3 font-display text-xl">{experiment.name}</h3><p className="mt-1 text-sm text-muted-foreground">{experiment.investmentLabel}</p><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><span>Current<br/><strong>{experiment.currentValue === null ? "—" : money(experiment.currentValue)}</strong></span><span>Return<br/><strong>{experiment.returnPct === null ? "—" : `${experiment.returnPct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`}</strong></span><span>Review<br/><strong>{shortDate(experiment.reviewDate)}</strong></span></div></button>)}</div>
      : <Empty icon={Landmark} title="No investment experiments yet" text="Start a paper trial to observe volatility and contributions without risking money." action={<Button onClick={dialog.openNew}><Plus /> Start a Paper Trial</Button>} />}
    <RecordDialog open={dialog.isOpen} onOpenChange={open => { if (!open) dialog.close(); }} title={dialog.record ? "Edit Investment Experiment" : "New Investment Experiment"}
      description="Paper trials use no real money. Actual experiments are manual logs only; the Lab never connects to a broker."
      fields={FORMS.investmentExperiments} initial={dialog.record ?? { mode: "Paper", status: "Planned" }}
      onSubmit={values => dialog.record ? update("investmentExperiments", dialog.record.id, values) : create("investmentExperiments", values)}
      onDelete={dialog.record ? () => archive("investmentExperiments", dialog.record!.id, dialog.record!.name) : undefined} />
  </div>;
}

function GrowthScenario() {
  const [start, setStart] = useState(1000); const [monthly, setMonthly] = useState(100); const [rate, setRate] = useState(6); const [years, setYears] = useState(10); const [fees, setFees] = useState(.2);
  const result = useMemo(() => { const r = Math.max(-99.9, rate - fees) / 100 / 12; const n = Math.max(0, years * 12); return r === 0 ? start + monthly * n : start * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r); }, [start, monthly, rate, years, fees]);
  return <div className="scenario-layout"><section className="panel"><SectionHeader eyebrow="Your Assumptions" title="Growth Scenario" description="Enter an illustrative rate. It is not supplied as a forecast." />
    <div className="scenario-inputs"><label>Starting amount<Input type="number" value={start} onChange={e => setStart(Number(e.target.value))} /></label><label>Monthly contribution<Input type="number" value={monthly} onChange={e => setMonthly(Number(e.target.value))} /></label><label>Illustrative annual rate (%)<Input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} /></label><label>Years<Input type="number" value={years} onChange={e => setYears(Number(e.target.value))} /></label><label>Estimated annual fees (%)<Input type="number" value={fees} onChange={e => setFees(Number(e.target.value))} /></label></div></section>
    <aside className="scenario-result"><Calculator /><p className="eyebrow">Illustrative future value</p><strong>{money(result)}</strong><p>Total contributions: {money(start + monthly * years * 12)}</p><p className="scenario-warning">Illustrative scenario — not a prediction of investment performance.</p></aside></div>;
}

function InvestingDiscovery() {
  const { state } = useLab();
  const findings = (state?.findings ?? []).filter(finding => finding.scope === "Investing");
  return <div><SectionHeader eyebrow="Connected Learning" title="Investing Discovery" description="Synthesize what your research and experiments teach you about risk, liquidity, structure, and your own reactions." />
    <FindingList findings={findings} defaults={{ scope: "Investing" }} emptyText="Examples: indexes are benchmarks, liquidity and horizon are separate, or a paper trial changed how volatility felt." /></div>;
}
