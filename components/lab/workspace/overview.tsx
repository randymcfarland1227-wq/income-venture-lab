"use client";

import { Clock3, Coins, Target } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  LONG_DIMENSIONS, SHORT_DIMENSIONS, effortAverage, includesLong, includesShort, moneyRange, relativeTime, shortDate, shortScore,
  type Idea,
} from "@/lib/domain";
import { WORKBOOKS } from "@/lib/sync/tabs";
import { useLab } from "../store";
import { Editable } from "../ui";
import { DetailField, useIdeaSave } from "./common";

export function OverviewModule({ idea }: { idea: Idea }) {
  const { state } = useLab();
  const save = useIdeaSave(idea);
  const short = includesShort(idea.horizon);
  const long = includesLong(idea.horizon);
  const history = (state?.history ?? []).filter(h => h.ideaId === idea.id);
  const score = shortScore(idea);

  return (
    <div className="ws-grid">
      <section className="ws-card span-2">
        <p className="eyebrow">Opportunity Thesis</p>
        <div className="mt-3 grid gap-4">
          <DetailField idea={idea} detail="thesis" label="Business Thesis" placeholder="Why could this work, for whom, and why now?" />
          <div className="summary-grid">
            <Summary icon={Coins} label="How It Earns">
              <Editable label="How it earns" hideLabel value={long ? idea.howItEarns : idea.incomeModel} placeholder="Define the model"
                onSave={long ? save.field("howItEarns") : save.field("incomeModel")} />
            </Summary>
            <Summary icon={Clock3} label="Time to First Cash">
              {long && !short
                ? <Editable label="Weeks to first dollar" hideLabel type="number" value={idea.weeksToFirst} placeholder="Weeks" onSave={save.field("weeksToFirst")} display={idea.weeksToFirst !== null ? `${idea.weeksToFirst} weeks` : undefined} />
                : <Editable label="First cash" hideLabel value={idea.firstCash} placeholder="e.g. 1–4 weeks" onSave={save.field("firstCash")} />}
            </Summary>
            <Summary icon={Target} label="First Evidence">
              <Editable label="First test" hideLabel value={idea.firstTest} placeholder="Define a low-cost test" onSave={save.field("firstTest")} />
            </Summary>
          </div>
        </div>
      </section>

      <section className="ws-card">
        <p className="eyebrow">Assumptions at a Glance</p>
        <dl className="glance-list">
          <Glance label="Startup Range" value={moneyRange(idea.startupLow, idea.startupHigh)}>
            <div className="flex gap-2">
              <Editable label="Startup low" type="money" value={idea.startupLow} onSave={save.field("startupLow")} placeholder="Low" />
              {long && <Editable label="Startup high" type="money" value={idea.startupHigh} onSave={save.field("startupHigh")} placeholder="High" />}
            </div>
          </Glance>
          <Glance label="Monthly Potential" value={moneyRange(idea.monthlyLow, idea.monthlyHigh)}>
            <div className="flex gap-2">
              <Editable label="Monthly low" type="money" value={idea.monthlyLow} onSave={save.field("monthlyLow")} placeholder="Low" />
              <Editable label="Monthly high" type="money" value={idea.monthlyHigh} onSave={save.field("monthlyHigh")} placeholder="High" />
            </div>
          </Glance>
          <Glance label="Hours per Week">
            <Editable label="Weekly hours" hideLabel type="number" value={idea.weeklyHours} onSave={save.field("weeklyHours")} placeholder="Not set" />
          </Glance>
          {long && (
            <Glance label="Monthly Operating Cost">
              <Editable label="Monthly cost" hideLabel type="money" value={idea.monthlyCost} onSave={save.field("monthlyCost")} placeholder="Not set" />
            </Glance>
          )}
          <Glance label="Category">
            <Editable label="Category" hideLabel value={idea.category} onSave={save.field("category")} placeholder="Not set" />
          </Glance>
          {short && (
            <Glance label="Tier">
              <Editable label="Tier" hideLabel type="select" options={["A", "B", "C", "D"]} value={idea.tier} onSave={save.field("tier")} placeholder="Not set" />
            </Glance>
          )}
        </dl>
      </section>

      <section className="ws-card span-3">
        <Accordion type="multiple" defaultValue={["story"]}>
          <AccordionItem value="story">
            <AccordionTrigger className="acc-trigger">Customer, Problem & Fit</AccordionTrigger>
            <AccordionContent>
              <div className="detail-grid">
                <DetailField idea={idea} detail="customer" label="Customer" placeholder="Who pays?" />
                <DetailField idea={idea} detail="problem" label="Problem / Desire" placeholder="What are they trying to solve or get?" />
                <DetailField idea={idea} detail="whyInterested" label="Why I’m Interested" />
                <div className="detail-field">
                  <Editable label="Personal Fit / Angle" type="textarea" value={idea.personalFitAngle} onSave={save.field("personalFitAngle")} placeholder="Skills, access, and experience that give you an edge" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="scores">
            <AccordionTrigger className="acc-trigger">
              Scoring Dimensions
              <span className="acc-aside">{[score !== null && short ? `Short-Term ${score}/100` : null, typeof idea.sheetFitScore === "number" && long ? `Fit ${idea.sheetFitScore}/100` : null].filter(Boolean).join(" · ")}</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">A score assists judgment — it never replaces it. Adjust any dimension; the dimensions stay visible on their own.</p>
              <div className="dimension-columns">
                {short && (
                  <div>
                    <p className="eyebrow mb-2">Short-Term (1 low – 5 high)</p>
                    {SHORT_DIMENSIONS.map(d => (
                      <Editable key={d.field} label={d.label} type="score" value={idea[d.field]} onSave={save.field(d.field)} className="dimension-row" />
                    ))}
                    <p className="dimension-total">Score: <strong>{score ?? "—"}</strong>/100 <span>(sum of six ÷ 30 × 100)</span></p>
                  </div>
                )}
                {long && (
                  <div>
                    <p className="eyebrow mb-2">Long-Term (effort: 1 light – 5 heavy)</p>
                    {LONG_DIMENSIONS.map(d => (
                      <Editable key={d.field} label={d.label} type="score" value={idea[d.field]} onSave={save.field(d.field)} className="dimension-row" />
                    ))}
                    <p className="dimension-total">Overall effort: <strong>{effortAverage(idea) ?? "—"}</strong>/5 · Fit Score: <strong>{idea.sheetFitScore ?? "—"}</strong>/100 <span>(calculated in the workbook from your Start Here weights)</span></p>
                  </div>
                )}
                {!short && !long && <p className="text-sm text-muted-foreground">Set a horizon to see its scoring dimensions.</p>}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes">
            <AccordionTrigger className="acc-trigger">Notes</AccordionTrigger>
            <AccordionContent>
              <Editable label="Notes" hideLabel type="textarea" value={idea.notes} onSave={save.field("notes")} placeholder="Open questions, observations, anything worth keeping" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="source">
            <AccordionTrigger className="acc-trigger">Source & History <span className="acc-aside">{history.length} events</span></AccordionTrigger>
            <AccordionContent>
              <dl className="source-list">
                <div><dt>Origin</dt><dd>{idea.source === "site" ? "Created in Income & Venture Lab" : idea.source === "snapshot" ? "Workbook snapshot (not yet linked to its live row)" : "Imported from Google Sheets"}</dd></div>
                {idea.sourceWorkbook && <div><dt>Workbook</dt><dd>{idea.sourceWorkbook}</dd></div>}
                {idea.sourceSheet && <div><dt>Sheet / Row</dt><dd>{idea.sourceSheet}{idea.sourceRow ? ` · row ${idea.sourceRow}` : ""}</dd></div>}
                {idea.importedAt && <div><dt>Imported</dt><dd>{shortDate(idea.importedAt)}</dd></div>}
                <div><dt>Sync ID</dt><dd><code className="text-xs">{idea.syncId}</code></dd></div>
                <div><dt>Represented In</dt><dd>{[short && WORKBOOKS.short.short, long && WORKBOOKS.long.short].filter(Boolean).join(" and ") || "—"}</dd></div>
              </dl>
              {history.length > 0 && (
                <ol className="history-list">
                  {history.map(h => <li key={h.id}><span>{h.summary}</span><time>{relativeTime(h.at)}</time></li>)}
                </ol>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}

function Summary({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="summary-item">
      <Icon aria-hidden />
      <span className="summary-label">{label}</span>
      <div className="summary-value">{children}</div>
    </div>
  );
}

function Glance({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="glance">
      <dt>{label}{value && <span className="glance-value">{value}</span>}</dt>
      <dd>{children}</dd>
    </div>
  );
}
