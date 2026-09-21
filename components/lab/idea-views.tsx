"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, FlaskConical, LayoutGrid, Rows3, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { incomeLevel, monthYear, passiveLevel, startupLevel, type Idea } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useLab } from "./store";
import { Empty, StatusPill } from "./ui";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type CardMetric = { label: string; value: (idea: Idea) => ReactNode };

export const DEFAULT_METRICS: CardMetric[] = [
  { label: "Startup", value: startupLevel },
  { label: "Income Potential", value: incomeLevel },
  { label: "Passive Potential", value: passiveLevel },
];

export function IdeaCard({ idea, metrics = DEFAULT_METRICS }: { idea: Idea; metrics?: CardMetric[] }) {
  const { go, data } = useLab();
  const running = data.actuals.get(idea.id)?.running ?? 0;
  const summary = (idea.description || idea.personalFitAngle || idea.howItEarns || "Ready for a thesis and a first low-cost test.")
    .replace(/income-opportunity pipeline/gi, "income plan");
  return (
    <button type="button" onClick={() => go(`idea/${idea.id}`)} className="idea-card">
      <div className="flex items-start justify-between gap-3">
        <span className="card-kicker">{[idea.horizon, idea.opportunityType, idea.incomeStyle].filter(Boolean).join(" · ")}</span>
        {running > 0 && (
          <span className="testing-flag" title={`${running} experiment running`}><FlaskConical className="size-3" /> Testing</span>
        )}
      </div>
      <h3 className="idea-card-title">{idea.title}</h3>
      <StatusPill status={idea.status} />
      <p className="idea-card-desc">{summary}</p>
      <dl className="card-metrics">
        {metrics.map(m => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value(idea)}</dd>
          </div>
        ))}
      </dl>
      <div className="idea-card-foot">
        <span>Updated {monthYear(idea.updatedAt)}</span>
        <span className="open-link">Open Workspace <ArrowUpRight className="size-3.5" /></span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export type Column = {
  key: string;
  label: string;
  value: (idea: Idea) => string | number | null;
  render?: (idea: Idea) => ReactNode;
  numeric?: boolean;
};

export function IdeaTable({ ideas, columns }: { ideas: Idea[]; columns: Column[] }) {
  const { go } = useLab();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return ideas;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return ideas;
    return [...ideas].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va === null || va === "") return 1;
      if (vb === null || vb === "") return -1;
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
    });
  }, [ideas, columns, sort]);

  return (
    <div className="table-wrap">
      <table className="lab-table">
        <thead>
          <tr>
            <th scope="col" className="sticky-col" aria-sort={ariaSort(sort?.key === "title" ? sort.dir : 0)}>
              <SortButton label="Opportunity" active={sort?.key === "title" ? sort.dir : 0}
                onClick={() => setSort(s => ({ key: "title", dir: s?.key === "title" && s.dir === 1 ? -1 : 1 }))} />
            </th>
            {columns.map(c => (
              <th key={c.key} scope="col" className={cn(c.numeric && "num")} aria-sort={ariaSort(sort?.key === c.key ? sort.dir : 0)}>
                <SortButton label={c.label} active={sort?.key === c.key ? sort.dir : 0}
                  onClick={() => setSort(s => ({ key: c.key, dir: s?.key === c.key && s.dir === -1 ? 1 : -1 }))} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(i => (
            <tr key={i.id} onClick={() => go(`idea/${i.id}`)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") go(`idea/${i.id}`); }}>
              <th scope="row" className="sticky-col">
                <span className="table-title">{i.title}</span>
                <span className="table-sub">{i.category}</span>
              </th>
              {columns.map(c => (
                <td key={c.key} className={cn(c.numeric && "num")}>{c.render ? c.render(i) : c.value(i) ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ariaSort = (dir: number) => (dir === 1 ? "ascending" : dir === -1 ? "descending" : "none");

function SortButton({ label, active, onClick }: { label: string; active: number; onClick: () => void }) {
  return (
    <button type="button" className="sort-button" onClick={onClick}>
      {label}
      {active === 1 ? <ArrowUp className="size-3" /> : active === -1 ? <ArrowDown className="size-3" /> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Library: filters + sort + card/table toggle
// ---------------------------------------------------------------------------

export type FilterDef =
  | { key: string; label: string; kind: "choice"; get: (idea: Idea) => string; options?: string[] }
  | { key: string; label: string; kind: "min" | "max"; get: (idea: Idea) => number | null; unit?: "money" | "score" }
  | { key: string; label: string; kind: "toggle"; get: (idea: Idea) => boolean };

export type SortDef = { key: string; label: string; value: (idea: Idea) => number | string | null; dir: 1 | -1 };

type FilterValue = string | number | boolean | null;

// Libraries only render after the client has loaded state, so reading storage here is safe.
function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return [value, set] as const;
}

export function OpportunityLibrary({
  ideas, filters, sorts, columns, metrics, storageKey, emptyTitle = "Nothing here yet", emptyText, toolbarExtra, groupBy,
}: {
  ideas: Idea[];
  filters: FilterDef[];
  sorts: SortDef[];
  columns: Column[];
  metrics?: CardMetric[];
  storageKey: string;
  emptyTitle?: string;
  emptyText: string;
  toolbarExtra?: ReactNode;
  groupBy?: (idea: Idea) => string;
}) {
  const [view, setView] = useStored<"cards" | "table">(`lab:view:${storageKey}`, "cards");
  const [sortKey, setSortKey] = useStored(`lab:sort:${storageKey}`, sorts[0]?.key ?? "");
  const [values, setValues] = useState<Record<string, FilterValue>>({});
  const [text, setText] = useState("");

  const active = Object.entries(values).filter(([, v]) => v !== null && v !== "" && v !== false);

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase();
    let list = ideas.filter(i => {
      if (q && !`${i.title} ${i.category} ${i.description} ${i.personalFitAngle} ${i.notes}`.toLowerCase().includes(q)) return false;
      for (const f of filters) {
        const v = values[f.key];
        if (v === null || v === undefined || v === "" || v === false) continue;
        if (f.kind === "choice" && f.get(i) !== v) return false;
        if (f.kind === "toggle" && !f.get(i)) return false;
        if (f.kind === "min") { const x = f.get(i); if (x === null || x < Number(v)) return false; }
        if (f.kind === "max") { const x = f.get(i); if (x === null || x > Number(v)) return false; }
      }
      return true;
    });
    const sort = sorts.find(s => s.key === sortKey) ?? sorts[0];
    if (sort) {
      list = [...list].sort((a, b) => {
        const va = sort.value(a);
        const vb = sort.value(b);
        if (va === null || va === "") return 1;
        if (vb === null || vb === "") return -1;
        return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
      });
    }
    return list;
  }, [ideas, filters, values, text, sorts, sortKey]);

  const choices = (f: Extract<FilterDef, { kind: "choice" }>) =>
    f.options ?? [...new Set(ideas.map(f.get).filter(Boolean))].sort();

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, Idea[]>();
    for (const i of visible) map.set(groupBy(i), [...(map.get(groupBy(i)) ?? []), i]);
    return [...map.entries()];
  }, [visible, groupBy]);

  return (
    <div className="library">
      <div className="library-toolbar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Filter by name…" className="library-search" aria-label="Filter by name" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="toolbar-button">
                <SlidersHorizontal /> Filters{active.length ? ` · ${active.length}` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="filter-panel">
              <div className="filter-grid">
                {filters.map(f => (
                  <label key={f.key} className={cn("filter-field", f.kind === "toggle" && "toggle")}>
                    <span>{f.label}</span>
                    {f.kind === "choice" ? (
                      <select value={String(values[f.key] ?? "")} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value || null }))}>
                        <option value="">Any</option>
                        {choices(f).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.kind === "toggle" ? (
                      <input type="checkbox" checked={Boolean(values[f.key])} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.checked }))} />
                    ) : (
                      <Input type="number" inputMode="decimal" value={values[f.key] === null || values[f.key] === undefined ? "" : String(values[f.key])}
                        placeholder={f.kind === "min" ? "At least" : "At most"}
                        onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))} />
                    )}
                  </label>
                ))}
              </div>
              {active.length > 0 && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setValues({})}><X /> Clear filters</Button>}
            </PopoverContent>
          </Popover>
          {sorts.length > 1 && (
            <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="toolbar-select" aria-label="Sort">
              {sorts.map(s => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
            </select>
          )}
          {toolbarExtra}
        </div>
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} title="Cards"><LayoutGrid className="size-4" /></button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} title="Table"><Rows3 className="size-4" /></button>
        </div>
      </div>

      {active.length > 0 && (
        <div className="filter-chips">
          {active.map(([key, v]) => {
            const f = filters.find(x => x.key === key);
            const label = f?.kind === "toggle" ? f.label : f?.kind === "min" ? `${f.label} ≥ ${v}` : f?.kind === "max" ? `${f.label} ≤ ${v}` : `${f?.label}: ${v}`;
            return (
              <button key={key} type="button" className="filter-chip" onClick={() => setValues(vals => ({ ...vals, [key]: null }))}>
                {label} <X className="size-3" />
              </button>
            );
          })}
        </div>
      )}

      <p className="library-count"><strong>{visible.length}</strong> of {ideas.length} opportunities</p>

      {visible.length === 0 ? (
        <Empty title={emptyTitle} text={active.length || text ? "No opportunities match these filters." : emptyText} />
      ) : view === "table" ? (
        <IdeaTable ideas={visible} columns={columns} />
      ) : groups ? (
        <div className="grid gap-10">
          {groups.map(([name, list]) => (
            <section key={name}>
              <h3 className="group-title">{name} <span>{list.length}</span></h3>
              <div className="idea-grid">{list.map(i => <IdeaCard key={i.id} idea={i} metrics={metrics} />)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="idea-grid">{visible.map(i => <IdeaCard key={i.id} idea={i} metrics={metrics} />)}</div>
      )}
    </div>
  );
}
