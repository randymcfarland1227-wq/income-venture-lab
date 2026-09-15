"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/domain";
import { ExperimentList, experimentNet } from "../experiments";
import { useLab } from "../store";
import { PageHeader, Stat } from "../ui";

const FILTERS = ["All", "Running", "Planned", "Complete", "Paused", "Stopped"];

export function ExperimentsPage() {
  const { state, go } = useLab();
  const [filter, setFilter] = useState("All");
  const all = useMemo(() => state?.experiments ?? [], [state?.experiments]);
  const visible = filter === "All" ? all : all.filter(e => e.status === filter);

  const totals = useMemo(() => {
    const net = all.reduce((a, e) => a + experimentNet(e).net, 0);
    const hours = all.reduce((a, e) => a + (e.actualHours ?? 0), 0);
    return {
      running: all.filter(e => e.status === "Running").length,
      planned: all.filter(e => e.status === "Planned").length,
      invested: all.reduce((a, e) => a + (e.directCosts ?? e.budget ?? 0), 0),
      net,
      perHour: hours ? net / hours : null,
    };
  }, [all]);
  const decisions = all.filter(e => e.finalDecision);

  return (
    <>
      <PageHeader
        eyebrow="Evidence Engine"
        title="Experiments"
        description="Every promising idea gets a small test, a budget, and a decision date. Track net results — not optimistic revenue."
      />
      <div className="stat-strip mb-8">
        <Stat label="Running" value={totals.running} />
        <Stat label="Planned" value={totals.planned} />
        <Stat label="Invested in Tests" value={money(totals.invested)} note="Direct costs, or budget if none yet" />
        <Stat label="Net Cash" value={money(totals.net)} note={totals.perHour === null ? "No hours logged yet" : `${money(totals.perHour)} per hour`} />
      </div>
      <div className="segmented mb-5" role="group" aria-label="Filter by status">
        {FILTERS.map(f => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f}<span>{f === "All" ? all.length : all.filter(e => e.status === f).length}</span>
          </button>
        ))}
      </div>
      <ExperimentList experiments={visible} />
      {decisions.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow">Decisions Log</p>
          <ul className="decision-log">
            {decisions.map(e => (
              <li key={e.id}>
                <span className="decision-badge">{e.finalDecision}</span>
                <button type="button" onClick={() => e.ideaId && go(`idea/${e.ideaId}/experiments`)}>{e.name || e.ideaLabel}</button>
                <span className="text-muted-foreground">{e.learning}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
