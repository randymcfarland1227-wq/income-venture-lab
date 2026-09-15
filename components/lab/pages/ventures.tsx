"use client";

import { useMemo } from "react";
import { isVenture } from "@/lib/domain";
import { OpportunityLibrary } from "../idea-views";
import { FILTERS, MIXED_COLUMNS, SORTS, validationFilter } from "../library-defs";
import { useLab } from "../store";
import { PageHeader } from "../ui";

export function VenturesPage() {
  const { data } = useLab();
  const ideas = useMemo(() => data.ideas.filter(isVenture), [data.ideas]);
  return (
    <>
      <PageHeader
        eyebrow="Venture Library"
        title="Business & Ventures"
        description="Every idea that could become an owned business — short term, long term, or both. Open one to build out its market, model, and evidence."
      />
      <OpportunityLibrary
        ideas={ideas}
        storageKey="ventures"
        filters={[FILTERS.horizon, FILTERS.style, FILTERS.category, FILTERS.type, FILTERS.stage, validationFilter(data.assumptionsByIdea), FILTERS.startupMax, FILTERS.monthlyMin]}
        sorts={[SORTS.potential, SORTS.score, SORTS.startup, SORTS.recent, SORTS.name]}
        columns={MIXED_COLUMNS}
        emptyText="Ideas typed as a service business, ecommerce, reselling, digital product, content, software, asset, property, or acquisition appear here."
      />
    </>
  );
}
