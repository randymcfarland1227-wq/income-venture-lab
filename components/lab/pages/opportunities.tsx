"use client";

import { useMemo } from "react";
import { Briefcase, Clock3, Layers3, Sparkles } from "lucide-react";
import { includesLong, includesShort, isPassive } from "@/lib/domain";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, MIXED_COLUMNS, SORTS, validationFilter } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { useLab } from "../store";
import { PageHeader } from "../ui";

const CAREER_TYPES = new Set(["Employment / Bridge Income", "Freelance"]);

export function OpportunitiesPage({ tab = "all" }: { tab?: string }) {
  const { data, go } = useLab();
  const all = data.ideas;
  const near = useMemo(() => all.filter(i => includesShort(i.horizon)), [all]);
  const long = useMemo(() => all.filter(i => includesLong(i.horizon)), [all]);
  const passive = useMemo(() => all.filter(isPassive), [all]);
  const career = useMemo(() => all.filter(i => CAREER_TYPES.has(i.opportunityType)), [all]);
  const list = tab === "near-term" ? near : tab === "long-term" ? long : tab === "passive" ? passive : tab === "career" ? career : all;
  const view = tab === "near-term"
    ? { icon: Clock3, title: "Near-Term Income", text: "Ways to create cash sooner. Businesses, services, assets, and work can all appear here." }
    : tab === "long-term"
      ? { icon: Layers3, title: "Long-Term Income", text: "Paths that can compound into durable income, ownership, or a larger body of work." }
      : tab === "passive"
        ? { icon: Sparkles, title: "Passive-ish", text: "Income with leverage over time—while keeping setup, distribution, and maintenance honest." }
        : tab === "career"
          ? { icon: Briefcase, title: "Career & Work", text: "Employment, bridge income, and freelance paths that strengthen the whole income plan." }
          : { icon: Layers3, title: "All Opportunities", text: "Your single source of truth. The tabs are lenses, so an opportunity can belong in more than one without being duplicated." };

  return (
    <div className="page-theme page-theme-opportunities">
      <PageHeader eyebrow="One System · Multiple Lenses" title="Opportunities"
        description="See every possible income path in one place, then narrow it by time horizon or working style. Nothing has to fit into only one box." />
      <div className="lens-guide" aria-label="How opportunity views work">
        <span className="lens-guide-icon"><view.icon /></span>
        <div><strong>{view.title}</strong><p>{view.text}</p></div>
        <button type="button" onClick={() => go("investing")} className="lens-guide-link">Investments & assets →</button>
      </div>
      <SectionTabs base="opportunities" active={tab} tabs={[
        ["all", "All", all.length], ["near-term", "Near-Term", near.length], ["long-term", "Long-Term", long.length],
        ["passive", "Passive-ish", passive.length], ["career", "Career & Work", career.length],
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
        columns={MIXED_COLUMNS} emptyText="Add an opportunity, or update one of the connected income workbooks." />
    </div>
  );
}
