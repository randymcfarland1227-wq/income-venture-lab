"use client";

import { useMemo } from "react";
import { Archive, BriefcaseBusiness, Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isVenture } from "@/lib/domain";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, MIXED_COLUMNS, SORTS, validationFilter } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { useLab } from "../store";
import { PageHeader } from "../ui";

export function VenturesPage({ tab = "studio" }: { tab?: string }) {
  const { data, setAddIdeaOpen } = useLab();
  const studio = useMemo(() => data.ideas.filter(i => i.ventureTrack === "Venture Studio"), [data.ideas]);
  const vault = useMemo(() => data.ideas.filter(i => i.ventureTrack === "Idea Vault"), [data.ideas]);
  const pipeline = useMemo(() => data.ideas.filter(i => isVenture(i) && !i.ventureTrack), [data.ideas]);
  const tabs: Array<[string, string, number]> = [
    ["studio", "Venture Studio", studio.length],
    ["vault", "Idea Vault", vault.length],
    ["pipeline", "Income Pipeline", pipeline.length],
  ];
  const list = tab === "vault" ? vault : tab === "pipeline" ? pipeline : studio;
  const copy = tab === "vault"
    ? { icon: Lightbulb, title: "Idea Vault", description: "A safe home for product, company, and invention concepts. Keep them without forcing them into an income experiment or launch plan.", empty: "Capture concepts here before deciding whether they deserve a full venture workspace." }
    : tab === "pipeline"
      ? { icon: Archive, title: "Income-Pipeline Ventures", description: "Business-like opportunities coming from the Short-Term and Long-Term income discovery workbooks.", empty: "Business opportunities from the income workbooks appear here." }
      : { icon: BriefcaseBusiness, title: "Venture Studio", description: "Businesses you are actively shaping. Develop the plan, brand, marketing, market, model, finances, and roadmap in one workspace.", empty: "Move a serious business into the Venture Studio, or create one here." };

  return (
    <>
      <PageHeader
        eyebrow="Build, Explore, or Preserve"
        title="Business & Ventures"
        description="Separate active businesses from early concepts and from the income-opportunity pipeline. Each can now develop at its own pace."
        actions={<Button className="rounded-full" onClick={() => setAddIdeaOpen(true)}><Plus /> Add Business or Idea</Button>}
      />
      <SectionTabs base="ventures" active={tab} tabs={tabs} />
      <section className="panel mb-6 flex items-start gap-4">
        <span className="area-icon"><copy.icon /></span>
        <div><h2 className="panel-title">{copy.title}</h2><p className="panel-sub mt-1 max-w-3xl">{copy.description}</p></div>
      </section>
      <OpportunityLibrary
        ideas={list}
        storageKey={`ventures:${tab}`}
        filters={tab === "pipeline"
          ? [FILTERS.horizon, FILTERS.style, FILTERS.category, FILTERS.type, FILTERS.stage, validationFilter(data.assumptionsByIdea), FILTERS.startupMax, FILTERS.monthlyMin]
          : [FILTERS.category, FILTERS.type, FILTERS.stage, validationFilter(data.assumptionsByIdea), FILTERS.startupMax]}
        sorts={[SORTS.recent, SORTS.potential, SORTS.score, SORTS.startup, SORTS.name]}
        columns={MIXED_COLUMNS}
        emptyText={copy.empty}
      />
    </>
  );
}
