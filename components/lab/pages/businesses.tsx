"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, PackageOpen, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isVenture } from "@/lib/domain";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, MIXED_COLUMNS, SORTS, validationFilter } from "../library-defs";
import { SectionTabs } from "../section-tabs";
import { useLab } from "../store";
import { PageHeader } from "../ui";

const PRODUCT_TYPES = new Set(["Ecommerce", "Digital Product", "Consumer Product", "Technology Product", "Software", "Content"]);
const ACTIVE = /building|earning|validated|testing|launch/i;

export function BusinessesPage({ tab = "active" }: { tab?: string }) {
  const { data, setAddIdeaOpen } = useLab();
  const businesses = useMemo(() => data.ideas.filter(i => isVenture(i) || i.ventureTrack === "Venture Studio"), [data.ideas]);
  const active = useMemo(() => businesses.filter(i => i.ventureTrack === "Venture Studio" || ACTIVE.test(i.status) || ["Build", "Launch", "Scale"].includes(i.stage)), [businesses]);
  const products = useMemo(() => businesses.filter(i => PRODUCT_TYPES.has(i.opportunityType)), [businesses]);
  const ideas = useMemo(() => businesses.filter(i => !active.includes(i)), [businesses, active]);
  const list = tab === "ideas" ? ideas : tab === "products" ? products : active;
  const copy = tab === "ideas"
    ? { icon: BriefcaseBusiness, title: "Business Ideas", text: "Promising business models that still need exploration before you commit to building." }
    : tab === "products"
      ? { icon: PackageOpen, title: "Products & Brands", text: "Physical products, digital products, software, content, ecommerce, and the brands around them." }
      : { icon: Store, title: "Active Businesses", text: "The businesses you are actually developing. Peculiar Candle and future active ventures get full planning, brand, marketing, finance, and roadmap tools." };

  return (
    <div className="page-theme page-theme-businesses">
      <PageHeader eyebrow="From Possibility to Company" title="Businesses"
        description="A clear home for business ideas, active companies, and products—without separating them from the income horizons they also support."
        actions={<Button className="rounded-full" onClick={() => setAddIdeaOpen(true)}><Plus /> Add Business</Button>} />
      <div className="section-identity"><span className="area-icon"><copy.icon /></span><div><strong>{copy.title}</strong><p>{copy.text}</p></div></div>
      <SectionTabs base="businesses" active={tab} tabs={[["active", "Active Businesses", active.length], ["ideas", "Business Ideas", ideas.length], ["products", "Products & Brands", products.length]]} />
      <OpportunityLibrary ideas={list} storageKey={`businesses:${tab}`}
        filters={[FILTERS.horizon, FILTERS.style, FILTERS.category, FILTERS.type, FILTERS.stage, validationFilter(data.assumptionsByIdea), FILTERS.startupMax]}
        sorts={[SORTS.recent, SORTS.potential, SORTS.score, SORTS.startup, SORTS.name]}
        columns={MIXED_COLUMNS} emptyText="Capture a business idea here, then move it forward when it earns your attention." />
    </div>
  );
}
