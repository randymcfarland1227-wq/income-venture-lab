"use client";

import { Lightbulb, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortDate, type Finding } from "@/lib/domain";
import { FORMS } from "./forms";
import { useLab } from "./store";
import { Empty, RecordDialog, Tag, useRecordDialog } from "./ui";

/** Synthesized conclusions — kept separate from raw research, which they may cite. */
export function FindingList({ findings, defaults, emptyText }: { findings: Finding[]; defaults: Partial<Finding>; emptyText: string }) {
  const { create, update, archive, state, data, go } = useLab();
  const dialog = useRecordDialog<Finding>();
  const researchTitle = (id: string) => state?.research.find(r => r.id === id)?.title;

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={dialog.openNew} className="rounded-full"><Plus /> Add Finding</Button>
      </div>
      {findings.length === 0 ? (
        <Empty icon={Lightbulb} title="No findings yet" text={emptyText} />
      ) : (
        <div className="finding-list">
          {[...findings].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).map(f => (
            <article key={f.id} className="finding-card">
              <Lightbulb className="finding-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-snug">{f.title}</h3>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => dialog.openEdit(f)} aria-label="Edit finding"><Pencil /></Button>
                </div>
                {f.body && <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>}
                {f.evidence && <p className="mt-2 text-sm leading-6"><span className="font-medium">Evidence:</span> {f.evidence}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Tag>{f.scope}</Tag>
                  {f.confidence && <Tag>{f.confidence} confidence</Tag>}
                  {f.ideaId && data.ideaById.get(f.ideaId) && (
                    <button type="button" className="link-chip" onClick={() => go(`idea/${f.ideaId}`)}>{data.ideaById.get(f.ideaId)?.title}</button>
                  )}
                  {f.cites.map(id => researchTitle(id) && <Tag key={id} className="cite-tag">Cites: {researchTitle(id)}</Tag>)}
                  <span className="ml-auto text-xs text-muted-foreground">{shortDate(f.updatedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <RecordDialog
        open={dialog.isOpen}
        onOpenChange={o => { if (!o) dialog.close(); }}
        title={dialog.record ? "Edit Finding" : "New Finding"}
        description="A conclusion drawn from research or experiments. Raw facts belong in Research."
        fields={FORMS.findings}
        initial={dialog.record ?? { scope: "Global", confidence: "Medium", cites: [], ...defaults }}
        onSubmit={values => (dialog.record ? update("findings", dialog.record.id, values) : create("findings", values))}
        onDelete={dialog.record ? () => archive("findings", (dialog.record as Finding).id, (dialog.record as Finding).title) : undefined}
      />
    </div>
  );
}
