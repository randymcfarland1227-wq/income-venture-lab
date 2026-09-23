"use client";

import { useMemo } from "react";
import { Clock3, Layers3, Sparkles } from "lucide-react";
import { includesLong, includesShort, isPassive } from "@/lib/domain";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, MIXED_COLUMNS, SORTS, validationFilter } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { useLab } from "../store";
import { PageHeader } from "../ui";

export function OpportunitiesPage({ tab = "all" }: { tab?: string }) {
  const { data, go } = useLab();
  // Income Pipeline only — not inventions, not Venture Studio businesses.
  const all = useMemo(() => data.ideas.filter(i => !i.ventureTrack && !i.deletedAt), [data.ideas]);
  const near = useMemo(() => all.filter(i => includesShort(i.horizon)), [all]);
  const long = useMemo(() => all.filter(i => includesLong(i.horizon)), [all]);
  const passive = useMemo(() => all.filter(isPassive), [all]);
  const list = tab === "near-term" ? near : tab === "long-term" ? long : tab === "passive" ? passive : all;
  const view = tab === "near-term"
    ? { icon: Clock3, title: "Near-Term Income", text: "Ways to create cash sooner—services, freelance, employment, assets, and other income paths." }
    : tab === "long-term"
      ? { icon: Layers3, title: "Long-Term Income", text: "Paths that can compound into durable income or ownership over years." }
      : tab === "passive"
        ? { icon: Sparkles, title: "Passive-ish", text: "Income with leverage over time—while keeping setup, distribution, and maintenance honest." }
        : { icon: Layers3, title: "All Opportunities", text: "Your income pipeline in one place. Employment and freelance paths appear here alongside other income options—without a separate career tab." };

  return (
    <div className="page-theme page-theme-opportunities">
      <PageHeader eyebrow="Income Pipeline" title="Opportunities"
        description="Short- and long-term income opportunities only—not inventions, not career-capital strategy meta-items, and not active businesses. Move a promising path into Business and Brand Ideas when you are ready to build." />
      <div className="lens-guide" aria-label="How opportunity views work">
        <span className="lens-guide-icon"><view.icon /></span>
        <div><strong>{view.title}</strong><p>{view.text}</p></div>
        <button type="button" onClick={() => go("investing")} className="lens-guide-link">Investments & assets →</button>
      </div>
      <SectionTabs base="opportunities" active={tab} tabs={[
        ["all", "All", all.length], ["near-term", "Near-Term", near.length], ["long-term", "Long-Term", long.length],
        ["passive", "Passive-ish", passive.length],
      ]} />
      {tab === "long-term" && <div className="strategy-horizon" aria-label="Long-term planning horizons">
        <div><span>1 year</span><strong>Build the foundation</strong></div>
        <div><span>3 years</span><strong>Prove durable income</strong></div>
        <div><span>5 years</span><strong>Scale ownership</strong></div>
        <div><span>10 years</span><strong>Create resilience & wealth</strong></div>
      </div>}
      <OpportunityLibrary ideas={list} storageKey={`opportunities:${tab}`}
        filters={[FILTERS.horizon, FILTERS.style, FILTERS.category, FILTERS.type, FILTERS.stage, FILTERS.status, validationFilter(data.assumptionsByIdea), FILTERS.startupMax, FILTERS.monthlyMin]}
        sorts={[SORTS.recent, SORTS.potential, SORTS.score, SORTS.startup, SORTS.name]}
        columns={MIXED_COLUMNS} emptyText="Add an income opportunity, or update one of the connected income workbooks." />
    </div>
  );
}
