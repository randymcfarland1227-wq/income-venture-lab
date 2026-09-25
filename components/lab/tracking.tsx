"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ListChecks, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LabTask } from "@/lib/domain";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Active / Not Active
// ---------------------------------------------------------------------------

/** Read-only marker shown next to a title on cards and tables. */
export function ActiveBadge({ active, compact, className }: { active?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("active-badge", active ? "is-active" : "is-inactive", compact && "compact", className)}>
      <span className="active-dot" aria-hidden />
      {active ? "Active" : "Not Active"}
    </span>
  );
}

/** Clickable marker for the workspace header; flips the record between active and not active. */
export function ActiveToggle({ active, onChange }: { active?: boolean; onChange: (next: boolean) => unknown }) {
  return (
    <button type="button" aria-pressed={Boolean(active)} onClick={() => void onChange(!active)}
      title={active ? "Mark as not active" : "Mark as active"}
      className={cn("active-badge toggle", active ? "is-active" : "is-inactive")}>
      <span className="active-dot" aria-hidden />
      {active ? "Active" : "Not Active"}
    </button>
  );
}

export const openTaskCount = (tasks?: LabTask[]) => (tasks ?? []).filter(t => !t.done).length;

// ---------------------------------------------------------------------------
// Task list
// ---------------------------------------------------------------------------

/**
 * A to-do list for one record. Edits show instantly; saves run one at a time and always
 * send the newest full list, so quick adds never overwrite each other on the way to Sheets.
 */
export function TaskList({ tasks, onSave, className }: {
  tasks?: LabTask[];
  onSave: (next: LabTask[]) => Promise<unknown>;
  className?: string;
}) {
  const [list, setList] = useState<LabTask[]>(tasks ?? []);
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const latest = useRef(list);
  const inFlight = useRef(false);
  const dirty = useRef(false);

  // Adopt the saved list (another tab, a sync) whenever none of our own writes are pending.
  const savedKey = JSON.stringify(tasks ?? []);
  useEffect(() => {
    if (inFlight.current) return;
    const saved = JSON.parse(savedKey) as LabTask[];
    latest.current = saved;
    setList(saved);
  }, [savedKey]);

  const flush = async () => {
    if (inFlight.current) { dirty.current = true; return; }
    inFlight.current = true;
    try {
      do {
        dirty.current = false;
        await onSave(latest.current);
      } while (dirty.current);
    } finally {
      inFlight.current = false;
    }
  };

  const commit = (next: LabTask[]) => {
    latest.current = next;
    setList(next);
    void flush();
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    commit([...latest.current, { id: crypto.randomUUID(), text: value, done: false, createdAt: new Date().toISOString(), doneAt: null }]);
    setText("");
  };

  const toggle = (id: string) => commit(latest.current.map(t => t.id === id
    ? { ...t, done: !t.done, doneAt: t.done ? null : new Date().toISOString() }
    : t));
  const remove = (id: string) => commit(latest.current.filter(t => t.id !== id));

  const open = list.filter(t => !t.done);
  const done = list.filter(t => t.done).sort((a, b) => String(b.doneAt ?? "").localeCompare(String(a.doneAt ?? "")));

  return (
    <section className={cn("ws-card task-card", className)}>
      <div className="task-head">
        <p className="eyebrow flex items-center gap-2"><ListChecks className="size-3.5" aria-hidden /> Tasks</p>
        <span className="task-count">{open.length ? `${open.length} to do` : list.length ? "All done" : ""}</span>
      </div>
      <form onSubmit={add} className="task-add">
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Add a task or next step…" aria-label="New task" />
        <Button type="submit" className="rounded-full" disabled={!text.trim()}><Plus /> Add</Button>
      </form>
      {open.length > 0 ? (
        <ul className="task-list">
          {open.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />)}
        </ul>
      ) : (
        <p className="task-empty">{list.length ? "Nothing open. Add the next step when you have one." : "No tasks yet. Add what needs to happen next."}</p>
      )}
      {done.length > 0 && (
        <>
          <button type="button" className="task-done-toggle" onClick={() => setShowDone(s => !s)} aria-expanded={showDone}>
            {showDone ? "Hide" : "Show"} {done.length} completed
          </button>
          {showDone && (
            <ul className="task-list done">
              {done.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function TaskRow({ task, onToggle, onRemove }: { task: LabTask; onToggle: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <li className={cn("task-row", task.done && "done")}>
      <button type="button" className="task-check" onClick={() => onToggle(task.id)} aria-pressed={task.done}
        aria-label={task.done ? `Mark “${task.text}” as not done` : `Mark “${task.text}” as done`}>
        {task.done && <Check className="size-3" />}
      </button>
      <span className="task-text">{task.text}</span>
      <button type="button" className="task-remove" onClick={() => onRemove(task.id)} aria-label={`Delete “${task.text}”`} title="Delete task">
        <X className="size-3.5" />
      </button>
    </li>
  );
}
