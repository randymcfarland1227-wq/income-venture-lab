"use client";

import { useMemo } from "react";
import { ArrowUpRight, FlaskConical, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { includesShort, money, shortDate, type Experiment, type SprintAction } from "@/lib/domain";
import { FORMS } from "./forms";
import { useLab } from "./store";
import { Empty, RecordDialog, StatusPill, useRecordDialog } from "./ui";

export function experimentNet(e: Experiment) {
  const net = (e.revenue ?? 0) - (e.directCosts ?? 0);
  return { net, perHour: e.actualHours ? net / e.actualHours : null };
}

export function ExperimentCard({ experiment: e, onEdit, showIdea = true }: { experiment: Experiment; onEdit: () => void; showIdea?: boolean }) {
  const { data, go } = useLab();
  const idea = e.ideaId ? data.ideaById.get(e.ideaId) : undefined;
  const syncsToTracker = !idea || includesShort(idea.horizon);
  const { net, perHour } = experimentNet(e);
  const assumption = e.assumptionId && idea ? data.assumptionsByIdea.get(idea.id)?.find(a => a.id === e.assumptionId) : undefined;

  return (
    <article className="experiment-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={e.status} />
        <span className="text-xs text-muted-foreground">
          {e.decisionDate ? `Decide by ${shortDate(e.decisionDate)}` : e.startDate ? `Started ${shortDate(e.startDate)}` : "No dates yet"}
        </span>
      </div>
      <h3 className="experiment-title">{e.name || e.hypothesis || e.ideaLabel || "Untitled experiment"}</h3>
      {showIdea && (idea ? (
        <button type="button" className="link-chip" onClick={() => go(`idea/${idea.id}/experiments`)}>{idea.title} <ArrowUpRight className="size-3" /></button>
      ) : e.ideaLabel ? <span className="link-chip muted">Tracker idea: {e.ideaLabel}</span> : null)}
      {e.name && e.hypothesis && <p className="experiment-hypothesis">{e.hypothesis}</p>}
      {e.testAction && (
        <div className="experiment-action">
          <span className="card-kicker">Test Action</span>
          <p>{e.testAction}</p>
        </div>
      )}
      {assumption && <p className="text-xs text-muted-foreground">Tests: “{assumption.assumption}”</p>}
      <dl className="card-metrics five">
        <div><dt>Budget</dt><dd>{money(e.budget)}</dd></div>
        <div><dt>Leads</dt><dd>{e.leads ?? "—"}</dd></div>
        <div><dt>Sales</dt><dd>{e.sales ?? "—"}</dd></div>
        <div><dt>Net Cash</dt><dd>{money(net)}</dd></div>
        <div><dt>Net $/Hr</dt><dd>{perHour === null ? "—" : money(perHour)}</dd></div>
      </dl>
      {(e.learning || e.finalDecision) && (
        <div className="experiment-learning">
          {e.finalDecision && <span className="decision-badge">Decision: {e.finalDecision}</span>}
          {e.learning && <p>{e.learning}</p>}
        </div>
      )}
      <div className="card-foot">
        <span className="text-xs text-muted-foreground">{syncsToTracker ? "Syncs with Short Term Income Tracker" : "Site-only (long-term idea)"}</span>
        <Button variant="ghost" size="sm" onClick={onEdit}><Pencil /> Edit & Record Results</Button>
      </div>
    </article>
  );
}

/** Experiments plus their add/edit dialog. Pass `ideaId` to scope and pre-link new experiments. */
export function ExperimentList({ experiments, ideaId, emptyText }: { experiments: Experiment[]; ideaId?: string; emptyText?: string }) {
  const { create, update, archive, data } = useLab();
  const dialog = useRecordDialog<Experiment>();
  const idea = ideaId ? data.ideaById.get(ideaId) : undefined;

  const ordered = useMemo(() => {
    const rank: Record<string, number> = { Running: 0, Planned: 1, Paused: 2, Complete: 3, Stopped: 4 };
    return [...experiments].sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || (b.updatedAt > a.updatedAt ? 1 : -1));
  }, [experiments]);

  const initial = useMemo(() => dialog.record ?? { ideaId: ideaId ?? null, status: "Planned", name: idea ? `${idea.title} test` : "" }, [dialog.record, ideaId, idea]);

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={dialog.openNew} className="rounded-full"><Plus /> New Experiment</Button>
      </div>
      {ordered.length === 0 ? (
        <Empty icon={FlaskConical} title="No experiments yet" text={emptyText ?? "Give a promising idea a bounded test, a budget, and a decision date."} />
      ) : (
        <div className="experiment-grid">
          {ordered.map(e => <ExperimentCard key={e.id} experiment={e} onEdit={() => dialog.openEdit(e)} showIdea={!ideaId} />)}
        </div>
      )}
      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Experiment" : "New Experiment"}
        description="Plan the test, then come back to record what happened."
        fields={FORMS.experiments}
        initial={initial}
        onSubmit={values => (dialog.record ? update("experiments", dialog.record.id, values) : create("experiments", values))}
        onDelete={dialog.record ? () => archive("experiments", (dialog.record as Experiment).id, (dialog.record as Experiment).name || "experiment") : undefined}
      />
    </div>
  );
}

export function SprintList({ actions }: { actions: SprintAction[] }) {
  const { create, update, archive, data } = useLab();
  const dialog = useRecordDialog<SprintAction>();
  const sorted = [...actions].sort((a, b) => (Number(a.day) || 99) - (Number(b.day) || 99));
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Day-by-day actions from the Actualizing Template — evidence and conversations, not a perfect brand.</p>
        <Button variant="outline" onClick={dialog.openNew} className="rounded-full"><Plus /> Add Action</Button>
      </div>
      {sorted.length === 0 ? (
        <Empty title="No sprint actions yet" text="Plan a short sprint: one action per day, each with a deliverable, a cost cap, and a success signal." />
      ) : (
        <ol className="sprint-list">
          {sorted.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => dialog.openEdit(a)} className="sprint-row">
                <span className="sprint-day">{a.day ? `Day ${a.day}` : "—"}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{a.action}</strong>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[a.deliverable, a.time, a.costCap !== null ? `cap ${money(a.costCap)}` : "", a.ideaId ? data.ideaById.get(a.ideaId)?.title : ""].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <StatusPill status={a.status || "Not Started"} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Sprint Action" : "New Sprint Action"}
        fields={FORMS.sprint}
        initial={dialog.record ?? { status: "Not Started" }}
        onSubmit={values => (dialog.record ? update("sprint", dialog.record.id, values) : create("sprint", values))}
        onDelete={dialog.record ? () => archive("sprint", (dialog.record as SprintAction).id, (dialog.record as SprintAction).action) : undefined}
      />
    </div>
  );
}
