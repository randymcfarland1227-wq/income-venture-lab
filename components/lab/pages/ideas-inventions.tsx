"use client";

import { useMemo } from "react";
import { Lightbulb, Plus, Rocket, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, MIXED_COLUMNS, SORTS, validationFilter } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { useLab } from "../store";
import { PageHeader } from "../ui";

const INVENTION_TYPES = new Set(["Technology Product", "Consumer Product", "Company Concept", "Software", "Other"]);

export function IdeasInventionsPage({ tab = "all" }: { tab?: string }) {
  const { data, setAddIdeaOpen } = useLab();
  const all = useMemo(() => data.ideas.filter(i => i.ventureTrack === "Idea Vault"), [data.ideas]);
  const concepts = useMemo(() => all.filter(i => ["Discover", "Validate"].includes(i.stage)), [all]);
  const inventions = useMemo(() => all.filter(i => INVENTION_TYPES.has(i.opportunityType)), [all]);
  const promoted = useMemo(() => all.filter(i => ["Build", "Launch", "Scale"].includes(i.stage) || /building|validated|earning/i.test(i.status)), [all]);
  const list = tab === "explore" ? concepts : tab === "inventions" ? inventions : tab === "promoted" ? promoted : all;
  return (
    <div className="page-theme page-theme-ideas">
      <PageHeader eyebrow="Keep the Spark · Lose the Pressure" title="Ideas & Inventions"
        description="A protected place for concepts like Smart Mirror—worth keeping and investigating, but not forced into an income plan before they are ready."
        actions={<Button className="rounded-full" onClick={() => setAddIdeaOpen(true)}><Plus /> Capture an Idea</Button>} />
      <div className="idea-manifesto">
        <span><Lightbulb /></span><div><strong>Ideas can stay ideas.</strong><p>Explore the problem, technology, audience, and possibilities. Promote one into a business only when that becomes the useful next step.</p></div>
      </div>
      <SectionTabs base="ideas" active={tab} tabs={[["all", "All Ideas", all.length], ["explore", "Concepts to Explore", concepts.length], ["inventions", "Ideas & Inventions", inventions.length], ["promoted", "Ready to Build", promoted.length]]} />
      <OpportunityLibrary ideas={list} storageKey={`ideas:${tab}`}
        filters={[FILTERS.category, FILTERS.type, FILTERS.stage, validationFilter(data.assumptionsByIdea)]}
        sorts={[SORTS.recent, SORTS.name, SORTS.potential]}
        columns={MIXED_COLUMNS} emptyText="Capture a concept without having to decide its income role yet." />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="path-card"><Shapes /><strong>Explore freely</strong><p>Build out the concept, market, competitors, and open questions.</p></div>
        <div className="path-card"><Rocket /><strong>Promote when ready</strong><p>The same workspace can grow into planning, validation, brand, and launch work.</p></div>
      </div>
    </div>
  );
}
