"use client";

import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/domain";
import { useLab } from "../store";
import { Empty, PageHeader } from "../ui";

/** Soft-deleted ideas. Their research, experiments, and history are intact. */
export function ArchivePage() {
  const { data, save, go } = useLab();
  const archived = [...data.archived].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  return (
    <>
      <PageHeader eyebrow="Nothing Is Destroyed" title="Archived Ideas"
        description="Archived on the site or through the _deleted checkbox in Sheets. Restoring brings back the idea and its Sheet row." />
      {archived.length === 0 ? (
        <Empty title="Nothing archived" text="Archived ideas keep their research, experiments, and history, and can be restored here." />
      ) : (
        <div className="grid gap-2.5">
          {archived.map(i => (
            <div key={i.id} className="idea-row">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => go(`idea/${i.id}`)}>
                <h3 className="truncate font-semibold">{i.title}</h3>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{i.horizon} · archived {relativeTime(i.deletedAt)}</p>
              </button>
              <Button variant="outline" className="rounded-full" onClick={() => void save({ op: "restore", collection: "ideas", id: i.id })}>
                <ArchiveRestore /> Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
