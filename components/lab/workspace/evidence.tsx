"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, FlaskConical, Map, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASSUMPTION_STATUSES, STAGES, includesLong, money, shortDate, type Assumption, type Experiment, type Idea, type Milestone,
  type ResearchItem,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { ExperimentList } from "../experiments";
import { FindingList } from "../findings";
import { FORMS } from "../forms";
import { useLab } from "../store";
import { Empty, RecordDialog, SectionHeader, StatusPill, useRecordDialog } from "../ui";
import { ModuleIntro, useIdeaSave } from "./common";
import { ResearchCard } from "./market";

export function ValidationModule({ idea }: { idea: Idea }) {
  const { data, create, update, archive } = useLab();
  const dialog = useRecordDialog<Assumption>();
  const [testing, setTesting] = useState<Assumption | null>(null);
  const assumptions = data.assumptionsByIdea.get(idea.id) ?? [];
  const experiments = data.experimentsByIdea.get(idea.id) ?? [];
  const counts = ASSUMPTION_STATUSES.map(s => [s, assumptions.filter(a => a.status === s).length] as const);
  const testInitial = useMemo(() => ({
    ideaId: idea.id, assumptionId: testing?.id ?? null, status: "Planned", name: testing ? `Test: ${testing.assumption.slice(0, 48)}` : "",
  }), [idea.id, testing]);

  return (
    <>
      <ModuleIntro icon={ShieldCheck} title="Validation" description="Name what must be true, then link the experiments that produce evidence for or against it."
        action={<Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Assumption</Button>} />

      {assumptions.length > 0 && (
        <div className="validation-summary">
          {counts.map(([status, n]) => (
            <div key={status} className={cn("validation-step", n > 0 && "has")}>
              <span className="validation-n">{n}</span>
              <span>{status}</span>
            </div>
          ))}
        </div>
      )}

      {assumptions.length === 0 ? (
        <Empty icon={ShieldCheck} title="No assumptions yet" text="Example: “Customers will pay $4,000+ for this service.” Then test it with an interview, a pre-sale, or a small market test." />
      ) : (
        <div className="grid gap-3">
          {assumptions.map(a => {
            const linked = experiments.filter(e => e.assumptionId === a.id);
            return (
              <article key={a.id} className="assumption-card">
                <select className="assumption-status" value={a.status} aria-label="Assumption status"
                  onChange={e => void update("assumptions", a.id, { status: e.target.value })}>
                  {ASSUMPTION_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <div className="min-w-0 flex-1">
                  <button type="button" className="text-left font-semibold leading-snug hover:underline" onClick={() => dialog.openEdit(a)}>{a.assumption}</button>
                  {a.evidence && <p className="mt-1 text-sm leading-6 text-muted-foreground">{a.evidence}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {linked.map(e => (
                      <span key={e.id} className="link-chip muted"><FlaskConical className="size-3" /> {e.name || e.hypothesis || "Experiment"} · {e.status}</span>
                    ))}
                    {!linked.length && <span className="text-xs text-muted-foreground">No linked evidence yet</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setTesting(a)}><FlaskConical /> Test This</Button>
              </article>
            );
          })}
        </div>
      )}

      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Assumption" : "New Assumption"}
        fields={FORMS.assumptions}
        initial={dialog.record ?? { status: "Unknown" }}
        onSubmit={values => (dialog.record ? update("assumptions", dialog.record.id, values) : create("assumptions", { ...values, ideaId: idea.id }))}
        onDelete={dialog.record ? () => archive("assumptions", (dialog.record as Assumption).id, "assumption") : undefined}
      />
      <RecordDialog
        open={testing !== null}
        onOpenChange={o => { if (!o) setTesting(null); }}
        title="New Experiment"
        description={testing ? `Produces evidence for: “${testing.assumption}”` : undefined}
        fields={FORMS.experiments.filter(f => f.section === "Plan")}
        initial={testInitial}
        onSubmit={async values => {
          await create("experiments", values);
          if (testing && testing.status === "Unknown") await update("assumptions", testing.id, { status: "Researching" });
        }}
        submitLabel="Create Experiment"
      />
    </>
  );
}

export function ExperimentsModule({ idea }: { idea: Idea }) {
  const { data } = useLab();
  const experiments: Experiment[] = data.experimentsByIdea.get(idea.id) ?? [];
  return (
    <>
      <ModuleIntro icon={FlaskConical} title="Experiments" description="Bounded tests with a budget, a success signal, and a decision date. One idea can run many." />
      <ExperimentList experiments={experiments} ideaId={idea.id}
        emptyText={idea.firstTest ? `The workbook suggests a first test: “${idea.firstTest}”.` : undefined} />
    </>
  );
}

export function ResearchModule({ idea }: { idea: Idea }) {
  const { data, create, update, archive } = useLab();
  const dialog = useRecordDialog<ResearchItem>();
  const [kind, setKind] = useState("All");
  const [q, setQ] = useState("");
  const all = data.researchByIdea.get(idea.id) ?? [];
  const kinds = ["All", ...new Set(all.map(r => r.kind))];
  const visible = all.filter(r => (kind === "All" || r.kind === kind)
    && (!q || `${r.title} ${r.body} ${r.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <ModuleIntro icon={BookOpen} title="Research & Learnings"
        description="Raw notes, links, questions, and observations — kept apart from the findings you conclude from them."
        action={<Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Research</Button>} />

      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search research…" className="library-search" aria-label="Search research" />
          <div className="segmented" role="group" aria-label="Filter by type">
            {kinds.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
          </div>
        </div>
      )}
      {visible.length === 0 ? (
        <Empty icon={BookOpen} title={all.length ? "Nothing matches" : "No research yet"} text="Save a note, a link, a document reference, or a question — with tags so it can be found later." />
      ) : (
        <div className="research-grid">{visible.map(r => <ResearchCard key={r.id} item={r} onEdit={() => dialog.openEdit(r)} />)}</div>
      )}

      <section className="mt-12">
        <SectionHeader eyebrow="Synthesized" title="Findings & Learnings" description="Conclusions drawn from the research and experiments above. They can cite specific research." />
        <FindingList findings={data.findingsByIdea.get(idea.id) ?? []} defaults={{ ideaId: idea.id, scope: "Idea" }}
          emptyText="When a pattern holds across several notes or tests, record it here." />
      </section>

      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Research" : "New Research"}
        fields={FORMS.research}
        initial={dialog.record ?? { kind: "Note", date: new Date().toISOString().slice(0, 10) }}
        onSubmit={values => (dialog.record ? update("research", dialog.record.id, values) : create("research", { ...values, ideaId: idea.id, area: "General" }))}
        onDelete={dialog.record ? () => archive("research", (dialog.record as ResearchItem).id, (dialog.record as ResearchItem).title) : undefined}
      />
    </>
  );
}

export function RoadmapModule({ idea }: { idea: Idea }) {
  const { data, create, update, archive } = useLab();
  const save = useIdeaSave(idea);
  const dialog = useRecordDialog<Milestone>();
  const milestones = data.milestonesByIdea.get(idea.id) ?? [];
  const current = STAGES.indexOf(idea.stage as (typeof STAGES)[number]);

  return (
    <>
      <ModuleIntro icon={Map} title="Roadmap"
        description={`Discover → Validate → Build → Launch → Scale. Move forward only when evidence supports it.${includesLong(idea.horizon) ? " Milestones sync to the 12-Month Plan." : ""}`}
        action={<Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Milestone</Button>} />
      <ol className="roadmap" aria-label="Stage">
        {STAGES.map((stage, i) => (
          <li key={stage}>
            <button type="button" onClick={() => void save.field("stage")(stage)} aria-current={i === current ? "step" : undefined}
              className={cn("roadmap-step", i < current && "done", i === current && "current")}>
              <span className="roadmap-dot">{i < current ? <Check className="size-3.5" /> : i + 1}</span>
              <strong>{stage}</strong>
              <small>{i === current ? "Current stage" : i < current ? "Passed" : `${milestones.filter(m => m.stage === stage).length} milestones`}</small>
            </button>
          </li>
        ))}
      </ol>

      {milestones.length === 0 ? (
        <Empty title="No milestones yet" text="Add a milestone with a target date, a spending cap, and a target income. Not every idea needs a 12-month plan." />
      ) : (
        <div className="stage-lanes mt-6">
          {STAGES.filter(s => milestones.some(m => m.stage === s)).map(stage => (
            <section key={stage} className="stage-lane">
              <h3 className="lane-title">{stage}</h3>
              {milestones.filter(m => m.stage === stage).map(m => (
                <button key={m.id} type="button" className="milestone-card" onClick={() => dialog.openEdit(m)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="card-kicker">{m.month ? `Month ${m.month}` : "Unscheduled"}{m.targetDate ? ` · ${shortDate(m.targetDate)}` : ""}</span>
                    <StatusPill status={m.status} />
                  </span>
                  <strong className="mt-2 block leading-snug">{m.title}</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {[m.spendingCap !== null ? `Cap ${money(m.spendingCap)}` : "", m.timeBudget !== null ? `${m.timeBudget} hrs` : "", m.targetIncome !== null ? `Target ${money(m.targetIncome)}/mo` : ""].filter(Boolean).join(" · ")}
                  </span>
                  {m.nextAction && <span className="mt-2 block text-xs">Next: {m.nextAction}</span>}
                  {m.evidenceNotes && <span className="mt-1 block text-xs text-muted-foreground">{m.evidenceNotes}</span>}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Milestone" : "New Milestone"}
        fields={FORMS.milestones.filter(f => f.key !== "ideaId")}
        initial={dialog.record ?? { stage: idea.stage || "Discover", status: "Not Started" }}
        onSubmit={values => (dialog.record ? update("milestones", dialog.record.id, values) : create("milestones", { ...values, ideaId: idea.id }))}
        onDelete={dialog.record ? () => archive("milestones", (dialog.record as Milestone).id, (dialog.record as Milestone).title) : undefined}
      />
    </>
  );
}
