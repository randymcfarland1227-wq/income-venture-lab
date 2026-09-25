"use client";

import { useMemo } from "react";
import { isPassive, money, num, passiveGroup } from "@/lib/domain";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, PASSIVE_METRICS, SORTS, incomePerMaintenanceHour, passiveColumns } from "../library-defs";
import { useLab } from "../store";
import { PageHeader, Stat } from "../ui";

export function PassivePage() {
  const { data } = useLab();
  const ideas = useMemo(() => data.ideas.filter(isPassive), [data.ideas]);

  const summary = useMemo(() => {
    const rated = ideas.filter(i => i.passivePotential);
    const best = ideas
      .map(i => ({ idea: i, value: incomePerMaintenanceHour(i, data.actuals.get(i.id)) }))
      .filter(x => x.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    return {
      avgPassive: rated.length ? rated.reduce((a, i) => a + (i.passivePotential ?? 0), 0) / rated.length : null,
      avgBuild: ideas.filter(i => i.setupEffort).reduce((a, i, _, arr) => a + (i.setupEffort ?? 0) / arr.length, 0),
      maintenanceHours: ideas.reduce((a, i) => a + (i.maintenanceHours ?? 0), 0),
      best,
    };
  }, [ideas, data.actuals]);

  return (
    <>
      <PageHeader
        eyebrow="Leverage Over Time"
        title="Passive Income"
        description="“Passive-ish” is the honest label: every asset here still needs building, distribution, and upkeep. Keep that effort visible next to the upside."
      />
      <div className="stat-strip mb-8">
        <Stat label="Passive-ish Opportunities" value={ideas.length} note="Passive-ish style or passive potential 4–5" />
        <Stat label="Average Passive Potential" value={summary.avgPassive === null ? "—" : `${num(summary.avgPassive)} / 5`} />
        <Stat label="Average Build Effort" value={summary.avgBuild ? `${num(summary.avgBuild)} / 5` : "—"} note="Setup effort, 5 = heaviest" />
        <Stat label="Best Income per Maintenance Hour" value={summary.best ? money(summary.best.value) : "—"}
          note={summary.best ? summary.best.idea.title : "Appears once an asset earns and has maintenance hours"} />
      </div>
      <OpportunityLibrary
        ideas={ideas}
        storageKey="passive"
        groupBy={passiveGroup}
        filters={[FILTERS.active, FILTERS.group, FILTERS.horizon, FILTERS.startupMax, FILTERS.passiveMin, FILTERS.maintenanceMax, FILTERS.monthlyMin]}
        sorts={[SORTS.passive, SORTS.maintenance, SORTS.potential, SORTS.startup, SORTS.weeks, SORTS.name]}
        columns={passiveColumns(data.actuals)}
        metrics={PASSIVE_METRICS}
        emptyText="Mark an idea Passive-ish, or rate its passive potential 4–5, and it appears here."
      />
    </>
  );
}
