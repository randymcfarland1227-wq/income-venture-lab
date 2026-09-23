"use client";

import { useMemo } from "react";
import { ArrowUpRight, BriefcaseBusiness, FlaskConical, History, Lightbulb, PieChart, Shapes } from "lucide-react";
import {
  isIncomePipelineIdea, isVenture, money, relativeTime, shortDate, shortScore, type Idea,
} from "@/lib/domain";
import { HEALTH_LABEL, SyncDot, useSyncHealth } from "../shell";
import { useLab } from "../store";
import { PageHeader, StatusPill } from "../ui";

const RESEARCHING = /research|testing/i;
const ADVANCED = new Set(["Build", "Launch", "Scale"]);

export function OverviewPage() {
  const { data, state, go } = useLab();
  const health = useSyncHealth();
  const ideas = data.ideas;

  const areas = useMemo(() => {
    const sum = (list: Idea[]) => list.reduce((acc, i) => {
      const a = data.actuals.get(i.id);
      return { revenue: acc.revenue + (a?.revenue ?? 0), net: acc.net + (a?.net ?? 0) };
    }, { revenue: 0, net: 0 });
    const running = (list: Idea[]) => list.filter(i => (data.actuals.get(i.id)?.running ?? 0) > 0).length;
    // "Under research" means there is actual research work on the idea, not just a default stage.
    const researched = (i: Idea) => data.researchByIdea.has(i.id) || data.competitorsByIdea.has(i.id)
      || data.assumptionsByIdea.has(i.id) || RESEARCHING.test(i.status) || i.stage === "Validate";
    // Examples favor what is in motion: running tests, then shortlisted ideas, then score.
    const rank = (i: Idea) => ((data.actuals.get(i.id)?.running ?? 0) > 0 ? 1000 : 0) + (i.status === "Shortlist" ? 500 : 0)
      + (shortScore(i) ?? i.sheetFitScore ?? 0);
    const top = (list: Idea[]) => [...list].sort((a, b) => rank(b) - rank(a)).slice(0, 2).map(i => i.title);

    const pipeline = ideas.filter(isIncomePipelineIdea);
    const ventures = ideas.filter(isVenture);
    const activeBusinesses = ventures.filter(i => i.ventureTrack === "Venture Studio" || ADVANCED.has(i.stage) || /validated|building|earning/i.test(i.status));
    const savedIdeas = ideas.filter(i => i.ventureTrack === "Idea Vault");
    const totals = sum(pipeline);
    const investments = state?.investments ?? [];

    return [
      {
        path: "opportunities", title: "Opportunities", icon: Shapes, tone: "coral", cta: "See the Whole Picture",
        count: pipeline.length,
        lines: [
          `${running(pipeline)} being tested`,
          totals.revenue || totals.net ? `${money(totals.revenue)} revenue · ${money(totals.net)} net` : "Near-term, long-term & passive-ish income",
        ],
        examples: top(pipeline.filter(i => i.status !== "Avoid for now")),
      },
      {
        path: "businesses", title: "Businesses", icon: BriefcaseBusiness, tone: "blue", cta: "Open Business Workspaces",
        count: activeBusinesses.length,
        lines: [
          `${ventures.filter(researched).length} under active research`,
          `${activeBusinesses.length} active or building`,
        ],
        examples: top(activeBusinesses),
      },
      {
        path: "ideas", title: "Ideas & Inventions", icon: Lightbulb, tone: "gold", cta: "Explore the Idea Space",
        count: savedIdeas.length,
        lines: [
          `${savedIdeas.filter(researched).length} being explored`,
          "No pressure to force an income route",
        ],
        examples: top(savedIdeas),
      },
      {
        path: "investing", title: "Investing & Assets", icon: PieChart, tone: "violet", cta: "Open Investing Lab",
        count: investments.length,
        lines: [
          `${investments.filter(i => /own|paper trial/i.test(i.status)).length} owned or in trial`,
          "Market facts stay externally authoritative",
        ],
        examples: investments.slice(0, 2).map(i => i.name),
      },
    ];
  }, [ideas, data, state?.investments]);

  const recent = useMemo(() => [...ideas].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).slice(0, 6), [ideas]);
  const activity = (state?.history ?? []).filter(h => h.entityType !== "system").slice(0, 5);
  const experiments = state?.experiments ?? [];
  const running = experiments.filter(e => e.status === "Running");
  const planned = experiments.filter(e => e.status === "Planned");
  const nextDecision = [...running, ...planned].filter(e => e.decisionDate).sort((a, b) => String(a.decisionDate).localeCompare(String(b.decisionDate)))[0];

  return (
    <>
      <PageHeader
        eyebrow="Your Opportunity Ecosystem"
        title="One place to see what matters now."
        description="Ideas can overlap without getting lost. Start with the whole picture, then move into the workspace that matches what you need to do next."
        actions={
          <button type="button" className="sync-chip" onClick={() => go("sync")}>
            <SyncDot health={health} /> {HEALTH_LABEL[health]}
            {state?.sync.lastSuccessAt && <span className="text-muted-foreground">· {relativeTime(state.sync.lastSuccessAt)}</span>}
          </button>
        }
      />

      <section className="area-grid" aria-label="Income areas">
        {areas.map(a => (
          <button key={a.path} type="button" onClick={() => go(a.path)} className={`area-card tone-${a.tone}`}>
            <div className="flex items-start justify-between">
              <span className="area-icon"><a.icon /></span>
              <ArrowUpRight className="size-5 text-foreground/35" />
            </div>
            <h2 className="area-title">{a.title}</h2>
            <p className="area-count"><strong>{a.count}</strong> opportunities</p>
            <ul className="area-lines">{a.lines.map(l => <li key={l}>{l}</li>)}</ul>
            {a.examples.length > 0 && <p className="area-examples">{a.examples.join(" · ")}</p>}
            <span className="area-cta">{a.cta} <ArrowUpRight className="size-4" /></span>
          </button>
        ))}
      </section>

      <section className="overview-lower">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="eyebrow">Recently Updated</p>
              <h2 className="section-title">Where You Left Off</h2>
            </div>
          </div>
          <div className="grid gap-2.5">
            {recent.map(i => (
              <button key={i.id} type="button" onClick={() => go(`idea/${i.id}`)} className="idea-row">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{i.title}</h3>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{i.horizon} · {i.category || i.opportunityType}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{relativeTime(i.updatedAt)}</span>
                <StatusPill status={i.status} />
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
          {activity.length > 0 && (
            <div className="activity-list">
              <p className="eyebrow flex items-center gap-2"><History className="size-3.5" /> Recent Changes</p>
              <ul>
                {activity.map(h => (
                  <li key={h.id}>
                    <button type="button" onClick={() => h.ideaId && go(`idea/${h.ideaId}`)} disabled={!h.ideaId}>
                      <span className="truncate">{h.ideaId ? `${data.ideaById.get(h.ideaId)?.title ?? "Idea"} — ` : ""}{h.summary}</span>
                      <span className="shrink-0 text-muted-foreground">{relativeTime(h.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="focus-panel">
          <div className="flex justify-between">
            <span className="eyebrow text-white/55">Experiment Pulse</span>
            <FlaskConical className="size-5 text-[#f6bd60]" />
          </div>
          <p className="focus-number">{running.length} running<br />{planned.length} planned</p>
          {nextDecision ? (
            <div className="mt-7 border-t border-white/12 pt-5">
              <p className="text-xs uppercase tracking-[.14em] text-white/50">Next Decision · {shortDate(nextDecision.decisionDate)}</p>
              <p className="mt-2 font-medium">{nextDecision.name || nextDecision.ideaLabel}</p>
              <p className="mt-1 text-sm leading-6 text-white/60">{nextDecision.hypothesis}</p>
            </div>
          ) : (
            <p className="mt-7 border-t border-white/12 pt-5 text-sm leading-6 text-white/60">No decisions scheduled. Give your strongest idea a bounded test.</p>
          )}
          <button type="button" onClick={() => go("experiments")} className="focus-link">Open Experiments <ArrowUpRight className="size-4" /></button>
        </aside>
      </section>
    </>
  );
}
