"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money, num, shortDate } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { FieldSpec } from "./forms";
import { useLab } from "./store";

// ---------------------------------------------------------------------------
// Headings & small display pieces
// ---------------------------------------------------------------------------

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-lede">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-lede">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES: Array<[RegExp, string]> = [
  [/running|testing|in progress|building|researching|validate|build|consider/i, "active"],
  [/shortlist|validated|evidence supports|done|complete|scale|earning|launch/i, "good"],
  [/avoid|stop|evidence against|blocked|paused|conflict|issue/i, "warn"],
];

export function StatusPill({ status, className }: { status: string; className?: string }) {
  if (!status) return null;
  const tone = TONES.find(([re]) => re.test(status))?.[1] ?? "neutral";
  return (
    <span className={cn("status-pill", `tone-${tone}`, className)}>
      <span className="status-shape" aria-hidden />
      {status}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("tag", className)}>{children}</span>;
}

export function Empty({ icon: Icon, title, text, action }: { icon?: React.ElementType; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {Icon && <Icon className="empty-icon" aria-hidden />}
      <p className="empty-title">{title}</p>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

/** A 1–5 rating shown as five segments. `invert` marks dimensions where lower is better. */
export function ScoreMeter({ value, label, invert = false }: { value: number | null; label: string; invert?: boolean }) {
  const v = typeof value === "number" ? Math.max(0, Math.min(5, value)) : 0;
  return (
    <div className="meter" aria-label={`${label}: ${value ?? "not rated"} of 5${invert ? " (lower is lighter)" : ""}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-track" aria-hidden>
        {[1, 2, 3, 4, 5].map(i => <span key={i} className={cn("meter-seg", i <= Math.round(v) && (invert ? "on-invert" : "on"))} />)}
      </span>
      <span className="meter-value">{value ?? "—"}</span>
    </div>
  );
}

export function formatValue(value: unknown, type: string) {
  if (value === null || value === undefined || value === "") return "";
  if (type === "money") return money(Number(value));
  if (type === "number" || type === "score") return num(Number(value));
  if (type === "date") return shortDate(String(value));
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// ---------------------------------------------------------------------------
// Inline editing
// ---------------------------------------------------------------------------

type EditableProps = {
  label: string;
  value: unknown;
  type?: "text" | "textarea" | "number" | "money" | "select" | "date" | "score";
  options?: readonly string[] | ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  onSave: (value: string | number | null) => void | Promise<unknown>;
  className?: string;
  display?: ReactNode;
  hideLabel?: boolean;
};

function optionList(options: EditableProps["options"]) {
  return (options ?? []).map(o => (typeof o === "string" ? { value: o, label: o } : o));
}

/** Click-to-edit value. Enter (or ⌘/Ctrl+Enter in long text) saves; Escape cancels. */
export function Editable({ label, value, type = "text", options, placeholder, onSave, className, display, hideLabel }: EditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (type === "score") {
    const current = typeof value === "number" ? value : null;
    return (
      <div className={cn("editable-score", className)}>
        {!hideLabel && <span className="editable-label">{label}</span>}
        <div className="score-picker" role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" role="radio" aria-checked={current === n}
              className={cn(current !== null && n <= current && "on", current === n && "current")}
              onClick={() => onSave(current === n ? null : n)}>{n}</button>
          ))}
        </div>
      </div>
    );
  }

  const commit = () => {
    setEditing(false);
    let next: string | number | null = draft.trim();
    if (type === "number" || type === "money") next = next === "" ? null : Number(next.replace(/[$,]/g, ""));
    if (typeof next === "number" && !Number.isFinite(next)) return;
    if (next === "" && type === "date") next = null;
    const before = value === null || value === undefined ? "" : String(value);
    if (String(next ?? "") !== before) void onSave(next);
  };

  const start = () => {
    setDraft(value === null || value === undefined ? "" : String(value));
    setEditing(true);
  };

  const shown = display ?? formatValue(value, type);

  return (
    <div className={cn("editable", editing && "is-editing", className)}>
      {!hideLabel && <span className="editable-label">{label}</span>}
      {editing ? (
        type === "textarea" ? (
          <Textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} rows={4}
            onKeyDown={e => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
            }} className="editable-input" aria-label={label} />
        ) : type === "select" ? (
          <select ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter") commit(); }} aria-label={label}>
            <option value="">—</option>
            {optionList(options).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <Input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
            type={type === "date" ? "date" : type === "number" || type === "money" ? "number" : "text"} step="any"
            onKeyDown={e => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter") commit(); }}
            className="editable-input" aria-label={label} />
        )
      ) : (
        <button type="button" className="editable-value" onClick={start} aria-label={`Edit ${label}`}>
          {shown ? <span className={cn(type === "textarea" && "whitespace-pre-wrap")}>{shown}</span> : <span className="editable-placeholder">{placeholder ?? "Add"}</span>}
          <Pencil className="editable-pencil" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record dialog — one form component for every record type
// ---------------------------------------------------------------------------

type RecordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldSpec[];
  initial: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<unknown> | void;
  submitLabel?: string;
  onDelete?: () => void;
};

export function RecordDialog(props: RecordDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="record-dialog">
        {/* Mounted only while open, so every opening starts from `initial`. */}
        {props.open && <RecordForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function RecordForm({ onOpenChange, title, description, fields, initial, onSubmit, submitLabel = "Save", onDelete }: RecordDialogProps) {
  const { state, data } = useLab();
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sections = useMemo(() => {
    const map = new Map<string, FieldSpec[]>();
    for (const f of fields) {
      const key = f.section ?? "";
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return [...map.entries()];
  }, [fields]);

  const set = (key: string, value: unknown) => setValues(v => ({ ...v, [key]: value }));
  const missing = fields.some(f => f.required && !String(values[f.key] ?? "").trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing) return;
    setBusy(true);
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.type === "number" || f.type === "money" || f.type === "score") out[f.key] = v === "" || v === undefined || v === null ? null : Number(v);
      else if (f.type === "tags") out[f.key] = Array.isArray(v) ? v : String(v ?? "").split(",").map(t => t.trim()).filter(Boolean);
      else if (f.type === "cites") out[f.key] = Array.isArray(v) ? v : [];
      else out[f.key] = v ?? "";
    }
    await onSubmit(out);
    setBusy(false);
    onOpenChange(false);
  };

  const ideaId = typeof values.ideaId === "string" ? values.ideaId : null;

  const control = (f: FieldSpec) => {
    const v = values[f.key];
    const id = `field-${f.key}`;
    switch (f.type) {
      case "textarea":
        return <Textarea id={id} value={String(v ?? "")} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} rows={3} />;
      case "select":
        return (
          <select id={id} value={String(v ?? "")} onChange={e => set(f.key, e.target.value)}>
            <option value="">—</option>
            {optionList(f.options).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "idea":
        return (
          <select id={id} value={String(v ?? "")} onChange={e => set(f.key, e.target.value || null)}>
            <option value="">Not linked</option>
            {[...data.ideas].sort((a, b) => a.title.localeCompare(b.title)).map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        );
      case "investment":
        return (
          <select id={id} value={String(v ?? "")} onChange={e => set(f.key, e.target.value || null)}>
            <option value="">Not linked</option>
            {[...(state?.investments ?? [])].filter(i => !i.deletedAt).sort((a, b) => a.name.localeCompare(b.name))
              .map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        );
      case "assumption": {
        const list = ideaId ? data.assumptionsByIdea.get(ideaId) ?? [] : [];
        return (
          <select id={id} value={String(v ?? "")} onChange={e => set(f.key, e.target.value || null)} disabled={!list.length}>
            <option value="">{list.length ? "None" : "No assumptions on this idea yet"}</option>
            {list.map(a => <option key={a.id} value={a.id}>{a.assumption}</option>)}
          </select>
        );
      }
      case "cites": {
        const list = (state?.research ?? []).filter(r => !ideaId || r.ideaId === ideaId);
        const chosen = new Set(Array.isArray(v) ? (v as string[]) : []);
        if (!list.length) return <p className="text-sm text-muted-foreground">No research recorded{ideaId ? " for this idea" : ""} yet.</p>;
        return (
          <div className="cite-list">
            {list.map(r => (
              <label key={r.id} className="cite-option">
                <input type="checkbox" checked={chosen.has(r.id)} onChange={e => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(r.id); else next.delete(r.id);
                  set(f.key, [...next]);
                }} />
                <span><strong>{r.kind}</strong> · {r.title}</span>
              </label>
            ))}
          </div>
        );
      }
      case "score":
        return (
          <div className="score-picker" role="radiogroup" aria-label={f.label}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={Number(v) === n}
                className={cn(Number(v) >= n && "on", Number(v) === n && "current")}
                onClick={() => set(f.key, Number(v) === n ? null : n)}>{n}</button>
            ))}
          </div>
        );
      case "tags":
        return <Input id={id} value={Array.isArray(v) ? v.join(", ") : String(v ?? "")} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder ?? "Comma-separated"} />;
      default:
        return (
          <Input id={id} value={v === null || v === undefined ? "" : String(v)} onChange={e => set(f.key, e.target.value)}
            placeholder={f.placeholder} step="any"
            type={f.type === "money" || f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"} />
        );
    }
  };

  return (
        <form onSubmit={submit}>
          <DialogHeader className="record-dialog-head">
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="record-dialog-body">
            {sections.map(([section, list]) => (
              <fieldset key={section || "main"} className="record-section">
                {section && <legend className="eyebrow">{section}</legend>}
                <div className="form-grid">
                  {list.map(f => (
                    <div key={f.key} className={cn("form-field", f.wide && "wide")}>
                      <Label htmlFor={`field-${f.key}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                      {control(f)}
                      {f.hint && <span className="form-hint">{f.hint}</span>}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <DialogFooter className="record-dialog-foot">
            {onDelete && (confirmDelete ? (
              <div className="mr-auto flex items-center gap-2 text-sm">
                <span>Archive this record?</span>
                <Button type="button" size="sm" variant="destructive" onClick={() => { onDelete(); onOpenChange(false); }}>Archive</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" className="mr-auto text-muted-foreground" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Archive
              </Button>
            ))}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || missing} className="rounded-full px-5"><Check /> {submitLabel}</Button>
          </DialogFooter>
        </form>
  );
}

/** Convenience hook: state for a RecordDialog that can open in "new" or "edit" mode. */
export function useRecordDialog<T extends { id: string }>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return {
    editing,
    openNew: () => setEditing("new"),
    openEdit: (record: T) => setEditing(record),
    close: () => setEditing(null),
    isOpen: editing !== null,
    record: editing && editing !== "new" ? editing : null,
  };
}
