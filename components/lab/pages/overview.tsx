"use client";

import { useMemo } from "react";
import { ArrowUpRight, BriefcaseBusiness, CircleDollarSign, FlaskConical, History, Landmark, Sparkles } from "lucide-react";
import {
  includesLong, includesShort, isPassive, isVenture, money, relativeTime, shortDate, shortScore, type Idea,
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

    const short = ideas.filter(i => includesShort(i.horizon));
    const ventures = ideas.filter(isVenture);
    const passive = ideas.filter(isPassive);
    const long = ideas.filter(i => includesLong(i.horizon));
    const shortTotals = sum(short);

    return [
      {
        path: "short-term", title: "Short-Term Income", icon: CircleDollarSign, tone: "coral", cta: "Open Short-Term Lab",
        count: short.length,
        lines: [
          `${running(short)} being tested`,
          shortTotals.revenue || shortTotals.net ? `${money(shortTotals.revenue)} revenue · ${money(shortTotals.net)} net` : "No revenue recorded yet",
        ],
        examples: top(short.filter(i => i.status !== "Avoid for now")),
      },
      {
        path: "ventures", title: "Business & Ventures", icon: BriefcaseBusiness, tone: "blue", cta: "Explore Ventures",
        count: ventures.length,
        lines: [
          `${ventures.filter(researched).length} under active research`,
          `${ventures.filter(i => ADVANCED.has(i.stage) || /validated|building/i.test(i.status)).length} validated or building`,
        ],
        examples: top(ventures),
      },
      {
        path: "passive", title: "Passive Income", icon: Sparkles, tone: "gold", cta: "Open Passive Lab",
        count: passive.length,
        lines: [
          `${passive.filter(researched).length} under research`,
          `${running(passive)} experiment${running(passive) === 1 ? "" : "s"} running`,
        ],
        examples: top(passive),
      },
      {
        path: "long-term", title: "Long-Term Income", icon: Landmark, tone: "violet", cta: "Explore Long-Term",
        count: long.length,
        lines: [
          `${long.filter(i => i.stage === "Discover").length} in discovery`,
          `${long.filter(i => i.stage === "Validate" || i.stage === "Build").length} in validation or build`,
        ],
        examples: top(long),
      },
    ];
  }, [ideas, data]);

  const recent = useMemo(() => [...ideas].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).slice(0, 6), [ideas]);
  const activity = (state?.history ?? []).filter(h => h.entityType !== "system").slice(0, 5);
  const experiments = state?.experiments ?? [];
  const running = experiments.filter(e => e.status === "Running");
  const planned = experiments.filter(e => e.status === "Planned");
  const nextDecision = [...running, ...planned].filter(e => e.decisionDate).sort((a, b) => String(a.decisionDate).localeCompare(String(b.decisionDate)))[0];

  return (
    <>
      <PageHeader
        eyebrow="Your Income Ecosystem"
        title="Turn Possibilities Into Evidence."
        description="Every path stays visible. Open any area — or any idea — when it earns a closer look."
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
