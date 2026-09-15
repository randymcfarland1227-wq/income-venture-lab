"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, type Idea } from "@/lib/domain";
import { useLab } from "../store";
import { Empty, PageHeader, SectionHeader, Stat } from "../ui";

type Month = { key: string; label: string; revenue: number; costs: number };

export function FinancialsPage() {
  const { state, data, go } = useLab();

  const rows = useMemo(() => data.ideas
    .map(idea => ({ idea, a: data.actuals.get(idea.id) }))
    .filter((r): r is { idea: Idea; a: NonNullable<typeof r.a> } => Boolean(r.a?.hasActuals))
    .sort((x, y) => y.a.net - x.a.net), [data]);

  const totals = useMemo(() => {
    const list = [...data.actuals.values()];
    const revenue = list.reduce((a, x) => a + x.revenue, 0);
    const costs = list.reduce((a, x) => a + x.costs, 0);
    const hours = list.reduce((a, x) => a + x.hours, 0);
    const unlinked = (state?.experiments ?? []).filter(e => !e.ideaId);
    const uRevenue = unlinked.reduce((a, e) => a + (e.revenue ?? 0), 0);
    const uCosts = unlinked.reduce((a, e) => a + (e.directCosts ?? 0), 0);
    return {
      revenue: revenue + uRevenue,
      costs: costs + uCosts,
      net: revenue + uRevenue - costs - uCosts,
      hours,
      invested: (state?.experiments ?? []).reduce((a, e) => a + (e.directCosts ?? 0), 0),
    };
  }, [data.actuals, state?.experiments]);

  const planned = useMemo(() => {
    const expenses = state?.expenses ?? [];
    return {
      oneTime: expenses.filter(x => x.costType !== "Monthly").reduce((a, x) => [a[0] + (x.low ?? 0), a[1] + (x.high ?? 0)], [0, 0]),
      monthly: expenses.filter(x => x.costType === "Monthly").reduce((a, x) => [a[0] + (x.low ?? 0), a[1] + (x.high ?? 0)], [0, 0]),
      caps: (state?.milestones ?? []).reduce((a, m) => a + (m.spendingCap ?? 0), 0),
      budgets: (state?.experiments ?? []).filter(e => e.status === "Running" || e.status === "Planned").reduce((a, e) => a + (e.budget ?? 0), 0),
    };
  }, [state]);

  const earning = rows.filter(r => r.a.net > 0);
  const consuming = rows.filter(r => r.a.costs > 0 && r.a.revenue === 0);

  return (
    <>
      <PageHeader
        eyebrow="Lightweight Financial View"
        title="Income & Financials"
        description="What is actually earning, what is consuming money, and what each hour returns. Not accounting — just enough to decide."
      />
      <div className="stat-strip mb-10">
        <Stat label="Revenue to Date" value={money(totals.revenue)} note="Experiments + plan actuals" />
        <Stat label="Costs to Date" value={money(totals.costs)} note="Direct costs + actual expenses" />
        <Stat label="Net Income" value={money(totals.net)} />
        <Stat label="Net per Hour" value={totals.hours ? money(totals.net / totals.hours) : "—"} note={totals.hours ? `${totals.hours} hours logged` : "Log hours on experiments"} />
      </div>

      {rows.length === 0 && totals.revenue === 0 && totals.costs === 0 ? (
        <Empty
          title="No actuals yet"
          text="Actual numbers come from experiment results (revenue, direct cost, hours), Actual Monthly Income in the 12-Month Plan, and Actual in the Cost Planner. Record them in either the site or the Sheets and they appear here."
          action={<Button variant="outline" className="mt-4 rounded-full" onClick={() => go("experiments")}>Record Experiment Results <ArrowUpRight /></Button>}
        />
      ) : (
        <div className="grid gap-10">
          <MonthlyTrend />
          <section>
            <SectionHeader eyebrow="By Opportunity" title="Revenue, Costs & Hours" />
            <div className="table-wrap">
              <table className="lab-table compact">
                <thead><tr><th>Opportunity</th><th className="num">Revenue</th><th className="num">Costs</th><th className="num">Net</th><th className="num">Hours</th><th className="num">Net $/Hr</th><th className="num">Invested in Tests</th></tr></thead>
                <tbody>
                  {rows.map(({ idea, a }) => (
                    <tr key={idea.id} onClick={() => go(`idea/${idea.id}/financials`)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") go(`idea/${idea.id}/financials`); }}>
                      <td className="font-medium">{idea.title}</td>
                      <td className="num">{money(a.revenue)}</td><td className="num">{money(a.costs)}</td>
                      <td className="num font-semibold">{money(a.net)}</td><td className="num">{a.hours || "—"}</td>
                      <td className="num">{a.netPerHour === null ? "—" : money(a.netPerHour)}</td><td className="num">{money(a.invested)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="pattern-grid two">
            <IdeaList title="Earning Now" sub="Net positive to date" rows={earning.map(r => ({ idea: r.idea, value: money(r.a.net) }))} empty="Nothing is net positive yet." />
            <IdeaList title="Consuming Money, Not Yet Earning" sub="Costs recorded, no revenue" rows={consuming.map(r => ({ idea: r.idea, value: money(-r.a.costs) }))} empty="No idea is spending without earning." />
          </div>
        </div>
      )}

      <section className="mt-10">
        <SectionHeader eyebrow="Committed & Planned" title="Money Set Aside for Testing" description="Estimates from the Cost Planner and caps from the 12-Month Plan — not spent yet." />
        <div className="stat-strip">
          <Stat label="Active Experiment Budgets" value={money(planned.budgets)} />
          <Stat label="Invested in Experiments" value={money(totals.invested)} note="Direct costs recorded" />
          <Stat label="Planned One-Time Costs" value={`${money(planned.oneTime[0])}–${money(planned.oneTime[1])}`} />
          <Stat label="Planned Monthly Costs" value={`${money(planned.monthly[0])}–${money(planned.monthly[1])}`} note={planned.caps ? `${money(planned.caps)} in plan spending caps` : undefined} />
        </div>
      </section>
    </>
  );
}

function IdeaList({ title, sub, rows, empty }: { title: string; sub: string; rows: Array<{ idea: Idea; value: string }>; empty: string }) {
  const { go } = useLab();
  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      <p className="panel-sub">{sub}</p>
      {rows.length ? (
        <ul className="pattern-list">
          {rows.map(r => <li key={r.idea.id}><button type="button" onClick={() => go(`idea/${r.idea.id}/financials`)}>{r.idea.title}</button><strong>{r.value}</strong></li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

const monthKey = (iso: string | null) => (iso && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null);

/** Revenue vs costs per month — two series, one axis, grouped columns. */
function MonthlyTrend() {
  const { state } = useLab();
  const [hover, setHover] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  const months = useMemo(() => {
    const map = new Map<string, Month>();
    const add = (iso: string | null, field: "revenue" | "costs", value: number | null) => {
      const key = monthKey(iso);
      if (!key || !value) return;
      const [y, m] = key.split("-").map(Number);
      const month = map.get(key) ?? { key, label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }), revenue: 0, costs: 0 };
      month[field] += value;
      map.set(key, month);
    };
    for (const e of state?.experiments ?? []) {
      add(e.startDate ?? e.decisionDate, "revenue", e.revenue);
      add(e.startDate ?? e.decisionDate, "costs", e.directCosts);
    }
    for (const m of state?.milestones ?? []) add(m.targetDate, "revenue", m.actualIncome);
    for (const x of state?.expenses ?? []) add(x.dueDate, "costs", x.actual);
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  }, [state]);

  if (!months.length) {
    return (
      <section>
        <SectionHeader eyebrow="Monthly Trend" title="Revenue and Costs by Month" />
        <p className="text-sm text-muted-foreground">Add dates to experiments, plan milestones, or expenses to see a monthly trend.</p>
      </section>
    );
  }

  const max = Math.max(...months.flatMap(m => [m.revenue, m.costs]), 1);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const active = months.find(m => m.key === hover);

  return (
    <section>
      <SectionHeader eyebrow="Monthly Trend" title="Revenue and Costs by Month"
        action={<Button variant="ghost" size="sm" onClick={() => setAsTable(t => !t)}><Table2 /> {asTable ? "Show Chart" : "Show Table"}</Button>} />
      <div className="viz-root panel">
        <div className="viz-legend" aria-hidden>
          <span><i className="viz-swatch s1" /> Revenue</span>
          <span><i className="viz-swatch s2" /> Costs</span>
        </div>
        {asTable ? (
          <div className="table-wrap mt-3">
            <table className="lab-table compact">
              <thead><tr><th>Month</th><th className="num">Revenue</th><th className="num">Costs</th><th className="num">Net</th></tr></thead>
              <tbody>{months.map(m => <tr key={m.key} className="cursor-default"><td>{m.label}</td><td className="num">{money(m.revenue)}</td><td className="num">{money(m.costs)}</td><td className="num">{money(m.revenue - m.costs)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : (
          <div className="viz-chart" role="img" aria-label={`Revenue and costs for ${months.length} months`}>
            <div className="viz-plot">
              {ticks.map(t => (
                <div key={t} className="viz-grid" style={{ bottom: `${(t / top) * 100}%` }}>
                  <span>{money(t, true)}</span>
                </div>
              ))}
              <div className="viz-groups">
                {months.map(m => (
                  <div key={m.key} className="viz-group" onMouseEnter={() => setHover(m.key)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(m.key)} onBlur={() => setHover(null)} tabIndex={0}
                    aria-label={`${m.label}: revenue ${money(m.revenue)}, costs ${money(m.costs)}`}>
                    <div className="viz-bars">
                      <span className="viz-bar s1" style={{ height: `${(m.revenue / top) * 100}%` }} />
                      <span className="viz-bar s2" style={{ height: `${(m.costs / top) * 100}%` }} />
                    </div>
                    <span className="viz-x">{m.label}</span>
                    {hover === m.key && active && (
                      <div className="viz-tip" role="tooltip">
                        <strong>{m.label}</strong>
                        <span><i className="viz-swatch s1" /> Revenue <b>{money(m.revenue)}</b></span>
                        <span><i className="viz-swatch s2" /> Costs <b>{money(m.costs)}</b></span>
                        <span className="viz-tip-net">Net <b>{money(m.revenue - m.costs)}</b></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
