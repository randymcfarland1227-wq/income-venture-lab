"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGES, includesLong, money, moneyRange, shortDate, type Expense, type Milestone } from "@/lib/domain";
import { FindingList } from "../findings";
import { FORMS } from "../forms";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, LONG_COLUMNS, LONG_METRICS, SORTS } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { OpenInSheet } from "../sheet-link";
import { useLab } from "../store";
import { Empty, PageHeader, RecordDialog, SectionHeader, Stat, StatusPill, useRecordDialog } from "../ui";

export function LongTermPage({ tab = "opportunities" }: { tab?: string }) {
  const { data, state } = useLab();
  const ideas = useMemo(() => data.ideas.filter(i => includesLong(i.horizon)), [data.ideas]);
  const belongs = (ideaId: string | null) => {
    const idea = ideaId ? data.ideaById.get(ideaId) : undefined;
    return !idea || includesLong(idea.horizon);
  };
  const milestones = (state?.milestones ?? []).filter(m => belongs(m.ideaId));
  const expenses = (state?.expenses ?? []).filter(x => belongs(x.ideaId));
  const findings = (state?.findings ?? []).filter(f => f.scope === "Long Term");

  return (
    <>
      <PageHeader
        eyebrow="Ownership Horizon"
        title="Long-Term Income"
        description="Compare opportunities worth validating, building, and compounding over time."
        actions={<OpenInSheet tab="longIdeas" />}
      />
      <SectionTabs base="long-term" active={tab} tabs={[
        ["opportunities", "Opportunities", ideas.length],
        ["plan", "12-Month Plan", milestones.length],
        ["costs", "Cost Planning", expenses.length],
        ["findings", "Findings", findings.length],
      ]} />

      {tab === "plan" ? <PlanBoard milestones={milestones} />
        : tab === "costs" ? <CostPlanner expenses={expenses} />
        : tab === "findings" ? (
          <FindingList findings={findings} defaults={{ scope: "Long Term" }}
            emptyText="Capture what you have learned about building durable income — capital needs, effort patterns, which models compound." />
        ) : (
          <OpportunityLibrary
            ideas={ideas}
            storageKey="long"
            filters={[FILTERS.status, FILTERS.category, FILTERS.style, FILTERS.stage, FILTERS.startupMax, FILTERS.weeksMax, FILTERS.monthlyMin, FILTERS.skillMin, FILTERS.interestMin, FILTERS.passiveMin, FILTERS.effortMax, FILTERS.fitScoreMin]}
            sorts={[SORTS.fit, SORTS.potential, SORTS.startup, SORTS.weeks, SORTS.passive, SORTS.recent, SORTS.name]}
            columns={LONG_COLUMNS}
            metrics={LONG_METRICS}
            emptyText="Add a long-term idea here, or add a row to Income Options in the workbook."
          />
        )}
    </>
  );
}

function PlanBoard({ milestones }: { milestones: Milestone[] }) {
  const { create, update, archive, data } = useLab();
  const dialog = useRecordDialog<Milestone>();
  const totals = useMemo(() => ({
    caps: milestones.reduce((a, m) => a + (m.spendingCap ?? 0), 0),
    peakTarget: Math.max(0, ...milestones.map(m => m.targetIncome ?? 0)),
    peakActual: Math.max(0, ...milestones.map(m => m.actualIncome ?? 0)),
    done: milestones.filter(m => m.status === "Done").length,
  }), [milestones]);
  const byMonth = new Map<number, Milestone[]>();
  for (const m of milestones) if (m.month) byMonth.set(m.month, [...(byMonth.get(m.month) ?? []), m]);

  return (
    <div className="grid gap-8">
      <div className="stat-strip">
        <Stat label="Total Spending Caps" value={money(totals.caps)} />
        <Stat label="Peak Target Monthly Income" value={money(totals.peakTarget)} />
        <Stat label="Peak Actual Monthly Income" value={money(totals.peakActual)} />
        <Stat label="Completed Milestones" value={`${totals.done} / ${milestones.length}`} />
      </div>

      <section>
        <SectionHeader eyebrow="Twelve Months" title="Plan at a Glance"
          description="Discover → Validate → Build → Scale. Advance only when evidence supports it."
          action={<div className="flex gap-2"><OpenInSheet tab="plan" label="Open 12-Month Plan" /><Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Milestone</Button></div>} />
        <div className="month-strip" role="list">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const list = byMonth.get(month) ?? [];
            return (
              <div key={month} role="listitem" className={`month-cell ${list.length ? `stage-${(list[0].stage || "Discover").toLowerCase()}` : ""}`}>
                <span className="month-num">M{month}</span>
                {list.map(m => (
                  <button key={m.id} type="button" onClick={() => dialog.openEdit(m)} className="month-item" title={m.title}>{m.title || m.ideaLabel || m.stage}</button>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {milestones.length === 0 ? (
        <Empty title="No milestones yet" text="Pick one long-term path and give it a milestone, a spending cap, and a target date. It syncs to the 12-Month Plan tab." />
      ) : (
        <div className="stage-lanes">
          {STAGES.map(stage => {
            const list = milestones.filter(m => (m.stage || "Discover") === stage).sort((a, b) => (a.month ?? 99) - (b.month ?? 99));
            return (
              <section key={stage} className="stage-lane">
                <h3 className="lane-title">{stage} <span>{list.length}</span></h3>
                {list.map(m => (
                  <button key={m.id} type="button" className="milestone-card" onClick={() => dialog.openEdit(m)}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="card-kicker">{m.month ? `Month ${m.month}` : "Unscheduled"}{m.targetDate ? ` · ${shortDate(m.targetDate)}` : ""}</span>
                      <StatusPill status={m.status} />
                    </span>
                    <strong className="mt-2 block leading-snug">{m.title || "Untitled milestone"}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">{m.ideaId ? data.ideaById.get(m.ideaId)?.title : m.ideaLabel || "No income path yet"}</span>
                    {(m.targetIncome || m.actualIncome) ? <span className="mt-2 block text-xs">Target {money(m.targetIncome)} · Actual {money(m.actualIncome)}</span> : null}
                    {m.nextAction && <span className="mt-2 block text-xs text-muted-foreground">Next: {m.nextAction}</span>}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Milestone" : "New Milestone"}
        description="Syncs to the 12-Month Plan when linked to a long-term idea."
        fields={FORMS.milestones}
        initial={dialog.record ?? { stage: "Discover", status: "Not Started" }}
        onSubmit={values => (dialog.record ? update("milestones", dialog.record.id, values) : create("milestones", values))}
        onDelete={dialog.record ? () => archive("milestones", (dialog.record as Milestone).id, (dialog.record as Milestone).title || "milestone") : undefined}
      />
    </div>
  );
}

export function CostPlanner({ expenses, ideaId }: { expenses: Expense[]; ideaId?: string }) {
  const { create, update, archive, data } = useLab();
  const dialog = useRecordDialog<Expense>();
  const sum = (list: Expense[], type: string, key: "low" | "high" | "actual") =>
    list.filter(x => (type === "Monthly" ? x.costType === "Monthly" : x.costType !== "Monthly")).reduce((a, x) => a + (x[key] ?? 0), 0);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const x of expenses) {
      const label = (x.ideaId && data.ideaById.get(x.ideaId)?.title) || x.ideaLabel || "Unassigned";
      map.set(label, [...(map.get(label) ?? []), x]);
    }
    return [...map.entries()];
  }, [expenses, data.ideaById]);

  return (
    <div className="grid gap-8">
      <div className="stat-strip">
        <Stat label="One-Time Estimate" value={moneyRange(sum(expenses, "One-time", "low"), sum(expenses, "One-time", "high"))} />
        <Stat label="Monthly Estimate" value={moneyRange(sum(expenses, "Monthly", "low"), sum(expenses, "Monthly", "high"))} />
        <Stat label="Actual Spent" value={money(expenses.reduce((a, x) => a + (x.actual ?? 0), 0))} />
        <Stat label="Essential Items" value={`${expenses.filter(x => /^y/i.test(x.essential)).length} / ${expenses.length}`} />
      </div>
      <SectionHeader eyebrow="Cost Planner" title="What It Takes to Start"
        description="Low and high are estimates; enter Actual only when known."
        action={<div className="flex gap-2">{!ideaId && <OpenInSheet tab="costs" label="Open Cost Planner" />}<Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Expense</Button></div>} />
      {groups.length === 0 ? (
        <Empty title="No expenses planned" text="Add the costs for the ideas you want to test. They sync to the Cost Planner tab." />
      ) : groups.map(([label, list]) => (
        <section key={label} className="panel p-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <h3 className="panel-title">{label}</h3>
            <span className="text-sm text-muted-foreground">
              {moneyRange(sum(list, "One-time", "low"), sum(list, "One-time", "high"))} one-time · {moneyRange(sum(list, "Monthly", "low"), sum(list, "Monthly", "high"))}/mo
            </span>
          </div>
          <div className="table-wrap mt-3 border-0 shadow-none">
            <table className="lab-table compact">
              <thead><tr><th>Item</th><th>Category</th><th>Type</th><th className="num">Low</th><th className="num">High</th><th className="num">Actual</th><th>Essential</th><th>Due</th></tr></thead>
              <tbody>
                {list.map(x => (
                  <tr key={x.id} onClick={() => dialog.openEdit(x)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") dialog.openEdit(x); }}>
                    <td className="font-medium">{x.item}</td><td>{x.category}</td><td>{x.costType}</td>
                    <td className="num">{money(x.low)}</td><td className="num">{money(x.high)}</td><td className="num">{money(x.actual)}</td>
                    <td>{x.essential}</td><td>{shortDate(x.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Expense" : "New Expense"}
        description="Syncs to the Cost Planner when linked to a long-term idea."
        fields={FORMS.expenses}
        initial={dialog.record ?? { ideaId: ideaId ?? null, costType: "One-time", essential: "Yes" }}
        onSubmit={values => (dialog.record ? update("expenses", dialog.record.id, values) : create("expenses", values))}
        onDelete={dialog.record ? () => archive("expenses", (dialog.record as Expense).id, (dialog.record as Expense).item) : undefined}
      />
    </div>
  );
}
