"use client";

import { useMemo } from "react";
import { includesShort, isIncomePipelineIdea, isShortTermNo, shortScore, type Idea } from "@/lib/domain";
import { ExperimentList, SprintList } from "../experiments";
import { FindingList } from "../findings";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, SHORT_COLUMNS, SHORT_METRICS, SORTS, activeExperimentFilter } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { OpenInSheet } from "../sheet-link";
import { SheetView } from "../sheet-view";
import { useLab } from "../store";
import { PageHeader, SectionHeader } from "../ui";

export function ShortTermPage({ tab = "opportunities" }: { tab?: string }) {
  const { data, state } = useLab();
  const ideas = useMemo(() => data.ideas.filter(i => includesShort(i.horizon) && isIncomePipelineIdea(i)), [data.ideas]);
  const experiments = useMemo(() => (state?.experiments ?? []).filter(e => {
    const sourceIdea = e.ideaId ? (state?.ideas ?? []).find(i => i.id === e.ideaId) : undefined;
    if (sourceIdea && isShortTermNo(sourceIdea)) return false;
    const idea = e.ideaId ? data.ideaById.get(e.ideaId) : undefined;
    return !idea || includesShort(idea.horizon);
  }), [state?.experiments, state?.ideas, data.ideaById]);
  const findings = (state?.findings ?? []).filter(f => f.scope === "Short Term");

  return (
    <>
      <PageHeader
        eyebrow="Cash-Flow Horizon"
        title="Short-Term Income"
        description="Compare near-term paths, run small tests, and learn what produces cash fastest."
        actions={<OpenInSheet tab="shortIdeas" />}
      />
      <SectionTabs base="short-term" active={tab} tabs={[
        ["opportunities", "Opportunities", ideas.length],
        ["experiments", "Experiments", experiments.length],
        ["findings", "Findings", findings.length],
        ["sheet", "Sheet View"],
      ]} />

      {tab === "experiments" ? (
        <div className="grid gap-12">
          <ExperimentList experiments={experiments} emptyText="Experiments here sync with the Short Term Income Tracker." />
          <section>
            <SectionHeader eyebrow="Actualizing Template" title="Sprint Plan" />
            <SprintList actions={state?.sprint ?? []} />
          </section>
        </div>
      ) : tab === "findings" ? (
        <div className="grid gap-12">
          <FindingList findings={findings} defaults={{ scope: "Short Term" }}
            emptyText="Record what the short-term discovery work taught you — which categories produce cash fastest, which skills keep showing up, what you ruled out and why." />
          <DerivedPatterns ideas={ideas} />
        </div>
      ) : tab === "sheet" ? (
        <SheetView tabs={["shortIdeas", "experiments", "sprint"]} />
      ) : (
        <OpportunityLibrary
          ideas={ideas}
          storageKey="short"
          filters={[FILTERS.status, FILTERS.category, FILTERS.tier, FILTERS.speedMin, FILTERS.startupMax, FILTERS.fitMin, FILTERS.demandMin, FILTERS.monthlyMin, activeExperimentFilter(data.actuals)]}
          sorts={[SORTS.score, SORTS.speed, SORTS.potential, SORTS.startup, SORTS.recent, SORTS.name]}
          columns={SHORT_COLUMNS}
          metrics={SHORT_METRICS}
          emptyText="Add a short-term idea here, or add a row to Income Ideas in the workbook."
        />
      )}
    </>
  );
}

/** Calculated from the catalog — patterns to consider, not conclusions. */
function DerivedPatterns({ ideas }: { ideas: Idea[] }) {
  const { state, go } = useLab();
  const live = ideas.filter(i => i.status !== "Avoid for now");

  const categories = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const i of live) {
      const s = shortScore(i);
      if (s !== null && i.category) map.set(i.category, [...(map.get(i.category) ?? []), s]);
    }
    return [...map.entries()]
      .map(([name, scores]) => ({ name, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), n: scores.length }))
      .sort((a, b) => b.avg - a.avg).slice(0, 5);
  }, [live]);

  const fastest = live.filter(i => (i.speed ?? 0) >= 4).slice(0, 6);
  const setAside = ideas.filter(i => i.status === "Avoid for now");
  const lessons = (state?.experiments ?? []).filter(e => e.learning.trim());

  return (
    <section>
      <SectionHeader eyebrow="Derived From Your Catalog" title="Patterns Worth Checking"
        description="Calculated from the scores in Income Ideas. They point at questions — turn the ones that hold up into findings above." />
      <div className="pattern-grid">
        <div className="panel">
          <h3 className="panel-title">Strongest Categories</h3>
          <p className="panel-sub">Average score, excluding ideas set aside</p>
          <ol className="pattern-list">
            {categories.map(c => (
              <li key={c.name}><span>{c.name}</span><span className="text-muted-foreground">{c.n} idea{c.n === 1 ? "" : "s"}</span><strong>{c.avg}</strong></li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <h3 className="panel-title">Fastest to First Cash</h3>
          <p className="panel-sub">Speed rated 4 or 5</p>
          <ul className="pattern-list">
            {fastest.map(i => (
              <li key={i.id}><button type="button" onClick={() => go(`idea/${i.id}`)}>{i.title}</button><span className="text-muted-foreground">{i.firstCash}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h3 className="panel-title">Set Aside — And Why</h3>
          <p className="panel-sub">Ideas marked “Avoid for now”</p>
          <ul className="pattern-list stacked">
            {setAside.map(i => (
              <li key={i.id}><button type="button" onClick={() => go(`idea/${i.id}`)}>{i.title}</button><span className="text-muted-foreground">{i.personalFitAngle}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h3 className="panel-title">Lessons From Experiments</h3>
          <p className="panel-sub">From Decision / learning in the tracker</p>
          {lessons.length ? (
            <ul className="pattern-list stacked">
              {lessons.map(e => <li key={e.id}><strong>{e.name || e.ideaLabel}</strong><span className="text-muted-foreground">{e.learning}</span></li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No learnings recorded yet. They appear here as experiments conclude.</p>}
        </div>
      </div>
    </section>
  );
}
