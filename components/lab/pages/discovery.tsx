"use client";

import { useMemo } from "react";
import { includesLong, includesShort, shortScore } from "@/lib/domain";
import { GUARDRAILS } from "@/lib/sync/tabs";
import { FindingList } from "../findings";
import { IdeaTable, type Column } from "../idea-views";
import { LONG_COLUMNS, SHORT_COLUMNS } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { OpenInSheet } from "../sheet-link";
import { useLab } from "../store";
import { Editable, PageHeader, SectionHeader, Stat } from "../ui";

const firstTest: Column = { key: "firstTest", label: "First Test", value: i => i.firstTest };
const notes: Column = { key: "notes", label: "Notes", value: i => i.notes };

export function DiscoveryPage({ tab = "short" }: { tab?: string }) {
  const { state } = useLab();
  return (
    <>
      <PageHeader
        eyebrow="The Intellectual Layer"
        title="Discovery Library"
        description="The thinking behind both workbooks — original catalogs, scores, guardrails, and the conclusions you have drawn across opportunities."
      />
      <SectionTabs base="discovery" active={tab} tabs={[
        ["short", "Short-Term Discovery"],
        ["long", "Long-Term Discovery"],
        ["guardrails", "Guardrails"],
        ["investing", "Investing Discovery", state?.findings.filter(f => f.scope === "Investing").length ?? 0],
        ["findings", "Synthesized Findings", state?.findings.length ?? 0],
      ]} />
      {tab === "long" ? <LongDiscovery /> : tab === "guardrails" ? <Guardrails /> : tab === "investing" ? (
        <FindingList findings={(state?.findings ?? []).filter(f => f.scope === "Investing")} defaults={{ scope: "Investing" }}
          emptyText="Findings about investment structure, liquidity, risk, or what your experiments taught you." />
      ) : tab === "findings" ? (
        <FindingList findings={state?.findings ?? []} defaults={{ scope: "Global" }}
          emptyText="Insights that apply across opportunities — e.g. “Low-startup service businesses consistently score better for near-term testing.”" />
      ) : <ShortDiscovery />}
    </>
  );
}

function ShortDiscovery() {
  const { data } = useLab();
  const ideas = useMemo(() => data.ideas.filter(i => includesShort(i.horizon) && !i.ventureTrack), [data.ideas]);
  const scored = ideas.map(shortScore).filter((s): s is number => s !== null);
  const repaired = ideas.some(i => i.sheetShortScore === null && shortScore(i) !== null);
  return (
    <div className="grid gap-6">
      <div className="stat-strip">
        <Stat label="Opportunities" value={ideas.length} />
        <Stat label="Shortlisted" value={ideas.filter(i => i.status === "Shortlist").length} />
        <Stat label="Median Score" value={scored.length ? [...scored].sort((a, b) => a - b)[Math.floor(scored.length / 2)] : "—"} />
        <Stat label="Set Aside" value={ideas.filter(i => i.status === "Avoid for now").length} />
      </div>
      <SectionHeader eyebrow="Randy — Short Term Income Discovery Workbook" title="Original Opportunity Catalog"
        description={repaired
          ? "Score /100 is recalculated here from the six 1–5 inputs, because the sheet formula returns #REF!. Running setup repairs the sheet column too."
          : "Six 1–5 inputs drive each score: speed, fit, demand, scalability, startup affordability, and risk."}
        action={<OpenInSheet tab="shortIdeas" />} />
      <IdeaTable ideas={ideas} columns={[...SHORT_COLUMNS, firstTest]} />
    </div>
  );
}

function LongDiscovery() {
  const { data, state, go } = useLab();
  const ideas = useMemo(() => data.ideas.filter(i => includesLong(i.horizon) && !i.ventureTrack), [data.ideas]);
  return (
    <div className="grid gap-6">
      <div className="stat-strip">
        <Stat label="Income Paths" value={ideas.length} />
        <Stat label="High Passive Potential" value={ideas.filter(i => (i.passivePotential ?? 0) >= 4).length} note="Rated 4–5" />
        <Stat label="Milestones Planned" value={state?.milestones.length ?? 0} note="12-Month Plan" />
        <Stat label="Expenses Planned" value={state?.expenses.length ?? 0} note="Cost Planner" />
      </div>
      <SectionHeader eyebrow="Long Term Income Discovery Workbook" title="Original Opportunity Catalog"
        description="Costs, passive potential, and the four effort ratings (1 light – 5 heavy) behind each Fit Score."
        action={<div className="flex flex-wrap gap-2">
          <button type="button" className="text-sm font-semibold underline-offset-4 hover:underline" onClick={() => go("long-term/plan")}>12-Month Plan</button>
          <button type="button" className="text-sm font-semibold underline-offset-4 hover:underline" onClick={() => go("long-term/costs")}>Cost Planning</button>
          <OpenInSheet tab="longIdeas" />
        </div>} />
      <IdeaTable ideas={ideas} columns={[...LONG_COLUMNS, firstTest, notes]} />
    </div>
  );
}

function Guardrails() {
  const { state, save } = useLab();
  const values = state?.guardrails ?? {};
  const groups: Array<["situation" | "weights", string, string]> = [
    ["situation", "Your Situation & Guardrails", "Planning assumptions every opportunity is measured against."],
    ["weights", "What Matters Most", "Weights from 1–5 that shape the long-term Fit Score."],
  ];
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">These sync with the Start Here tab of the long-term workbook. Click any value to change it.</p>
        <OpenInSheet tab="guardrails" label="Open Start Here" />
      </div>
      <div className="guardrail-grid">
        {groups.map(([key, title, text]) => (
          <section key={key} className="panel">
            <h3 className="panel-title">{title}</h3>
            <p className="panel-sub">{text}</p>
            <div className="mt-4 grid">
              {GUARDRAILS.filter(g => g.group === key).map(g => (
                <div key={g.key} className="guardrail-row">
                  <Editable
                    label={g.label}
                    value={values[g.key] ?? null}
                    type={g.group === "weights" ? "score" : g.type === "number" && /income|cash/.test(g.key) ? "money" : g.type === "date" ? "date" : g.type === "number" ? "number" : "text"}
                    placeholder="Not set"
                    onSave={v => save({ op: "setGuardrail", key: g.key, value: v })}
                  />
                  <span className="guardrail-hint">{g.hint}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
