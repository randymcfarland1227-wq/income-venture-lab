"use client";

import { useMemo, useState } from "react";
import { ExternalLink, LayoutGrid, Layers3, Plus, Rows3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortDate, type Competitor, type Idea, type ResearchItem } from "@/lib/domain";
import { FORMS } from "../forms";
import { useLab } from "../store";
import { Empty, RecordDialog, SectionHeader, Tag, useRecordDialog } from "../ui";
import { DetailField, ModuleIntro } from "./common";

const MARKET_FIELDS = [
  ["targetCustomers", "Target Customers", "Who specifically buys?"],
  ["segments", "Customer Segments", "Distinct groups with different needs or budgets"],
  ["geography", "Geographic Market", "Where you can realistically serve"],
  ["customerNeeds", "Customer Needs", "What they value most"],
  ["pricingNotes", "Pricing Observations", "What people pay today"],
  ["demandIndicators", "Demand Indicators", "Searches, waitlists, bookings, reviews…"],
  ["marketSize", "Market Size Notes", "Rough sizing — how many, how much"],
  ["trends", "Market Trends", "What is changing"],
  ["marketQuestions", "Unresolved Market Questions", "What would change your mind?"],
] as const;

export function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function ResearchCard({ item, onEdit }: { item: ResearchItem; onEdit: () => void }) {
  return (
    <article className="research-card">
      <button type="button" className="research-main" onClick={onEdit}>
        <span className="flex flex-wrap items-center gap-2">
          <Tag>{item.kind}</Tag>
          {item.confidence && <span className="text-xs text-muted-foreground">{item.confidence} confidence</span>}
          {item.date && <span className="text-xs text-muted-foreground">{shortDate(item.date)}</span>}
        </span>
        <strong className="mt-2 block leading-snug">{item.title}</strong>
        {item.body && <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">{item.body}</span>}
      </button>
      {(item.sourceUrl || item.tags.length > 0) && (
        <div className="research-foot">
          {item.sourceUrl && (/^https?:/.test(item.sourceUrl)
            ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="source-link">{hostname(item.sourceUrl)} <ExternalLink className="size-3" /></a>
            : <span className="text-xs text-muted-foreground">{item.sourceUrl}</span>)}
          {item.tags.map(t => <Tag key={t} className="tag-soft">#{t}</Tag>)}
        </div>
      )}
    </article>
  );
}

export function MarketModule({ idea }: { idea: Idea }) {
  const { data, create, update, archive } = useLab();
  const dialog = useRecordDialog<ResearchItem>();
  const [showAll, setShowAll] = useState(false);
  const items = (data.researchByIdea.get(idea.id) ?? []).filter(r => r.area === "Market");
  const filled = MARKET_FIELDS.filter(([k]) => idea.details[k]);
  const fields = showAll || filled.length === 0 ? MARKET_FIELDS : filled.length < 4 ? MARKET_FIELDS.slice(0, Math.max(4, filled.length)) : filled;

  return (
    <>
      <ModuleIntro icon={Users} title="Market" description="Who buys, what they need, what they pay, and how you know. Collect facts first; turn repeated evidence into findings later." />
      <div className="detail-grid three">
        {fields.map(([key, label, placeholder]) => <DetailField key={key} idea={idea} detail={key} label={label} placeholder={placeholder} />)}
      </div>
      {fields.length < MARKET_FIELDS.length && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(true)}>Show all market fields ({MARKET_FIELDS.length})</Button>
      )}

      <section className="mt-10">
        <SectionHeader eyebrow="Evidence" title="Market Research"
          description="Individual findings with a source, date, and confidence level."
          action={<Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Research</Button>} />
        {items.length === 0 ? (
          <Empty title="No market research yet" text="Save a pricing observation, a demand signal, or a data point — with where it came from." />
        ) : (
          <div className="research-grid">{items.map(r => <ResearchCard key={r.id} item={r} onEdit={() => dialog.openEdit(r)} />)}</div>
        )}
      </section>

      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Market Research" : "New Market Research"}
        fields={FORMS.marketResearch}
        initial={dialog.record ?? { kind: "Observation", confidence: "Medium", date: new Date().toISOString().slice(0, 10) }}
        onSubmit={values => (dialog.record ? update("research", dialog.record.id, values) : create("research", { ...values, ideaId: idea.id, area: "Market" }))}
        onDelete={dialog.record ? () => archive("research", (dialog.record as ResearchItem).id, (dialog.record as ResearchItem).title) : undefined}
      />
    </>
  );
}

export function CompetitionModule({ idea }: { idea: Idea }) {
  const { data, create, update, archive } = useLab();
  const dialog = useRecordDialog<Competitor>();
  const [view, setView] = useState<"cards" | "table">("cards");
  const competitors = useMemo(() => [...(data.competitorsByIdea.get(idea.id) ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data, idea.id]);

  return (
    <>
      <ModuleIntro icon={Layers3} title="Competition" description="How alternatives are priced and positioned — and where they leave room."
        action={<Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Competitor</Button>} />

      <section className="ws-card mb-8">
        <DetailField idea={idea} detail="differentiation" label="Competitive Opportunity / Differentiation"
          placeholder="Where can you be more specific, useful, trusted, or efficient than the alternatives?" />
      </section>

      {competitors.length === 0 ? (
        <Empty icon={Layers3} title="No competitors recorded" text="Add a named competitor with a URL, pricing, strengths, and weaknesses." />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">{competitors.length}</strong> competitors</p>
            <div className="view-toggle" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} title="Cards"><LayoutGrid className="size-4" /></button>
              <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} title="Table"><Rows3 className="size-4" /></button>
            </div>
          </div>
          {view === "table" ? (
            <div className="table-wrap">
              <table className="lab-table compact">
                <thead><tr><th>Name</th><th>Location</th><th>Target Customer</th><th>Pricing</th><th>Strengths</th><th>Weaknesses</th></tr></thead>
                <tbody>
                  {competitors.map(c => (
                    <tr key={c.id} onClick={() => dialog.openEdit(c)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") dialog.openEdit(c); }}>
                      <td className="font-medium">{c.name}</td><td>{c.location}</td><td>{c.targetCustomer}</td><td>{c.pricing}</td>
                      <td className="max-w-64 truncate">{c.strengths}</td><td className="max-w-64 truncate">{c.weaknesses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="competitor-grid">
              {competitors.map(c => (
                <article key={c.id} className="competitor-card">
                  <button type="button" className="w-full text-left" onClick={() => dialog.openEdit(c)}>
                    <span className="card-kicker">{[c.category, c.location].filter(Boolean).join(" · ") || "Competitor"}</span>
                    <h3 className="mt-1.5 text-lg font-semibold">{c.name}</h3>
                    {c.positioning && <p className="mt-1 text-sm leading-6 text-muted-foreground">{c.positioning}</p>}
                    <dl className="competitor-facts">
                      {c.pricing && <div><dt>Pricing</dt><dd>{c.pricing}</dd></div>}
                      {c.targetCustomer && <div><dt>Serves</dt><dd>{c.targetCustomer}</dd></div>}
                      {c.strengths && <div><dt>Strengths</dt><dd>{c.strengths}</dd></div>}
                      {c.weaknesses && <div><dt>Weaknesses</dt><dd>{c.weaknesses}</dd></div>}
                      {c.features && <div><dt>Notable</dt><dd>{c.features}</dd></div>}
                    </dl>
                  </button>
                  {c.url && <a className="source-link mt-3" href={/^https?:/.test(c.url) ? c.url : `https://${c.url}`} target="_blank" rel="noreferrer">{hostname(c.url)} <ExternalLink className="size-3" /></a>}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Competitor" : "New Competitor"}
        fields={FORMS.competitors}
        initial={dialog.record ?? {}}
        onSubmit={values => (dialog.record ? update("competitors", dialog.record.id, values) : create("competitors", { ...values, ideaId: idea.id }))}
        onDelete={dialog.record ? () => archive("competitors", (dialog.record as Competitor).id, (dialog.record as Competitor).name) : undefined}
      />
    </>
  );
}
