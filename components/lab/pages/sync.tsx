"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeftRight, ArrowRight, ArrowLeft, ExternalLink, KeyRound, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, relativeTime, shortDate, type SyncConflict, type SyncEvent } from "@/lib/domain";
import { GUARDRAILS, TABS, TAB_ORDER, WORKBOOKS, type TabKey } from "@/lib/sync/tabs";
import { cn } from "@/lib/utils";
import { OpenInSheet } from "../sheet-link";
import { HEALTH_LABEL, SyncDot, useSyncHealth } from "../shell";
import { useLab } from "../store";
import { Empty, PageHeader, SectionHeader } from "../ui";

type Activity = { events: SyncEvent[]; pendingMissing: Partial<Record<TabKey, number>> };

const MONEY = /cost|income|startup|monthly|budget|revenue|cap|estimate|actual|low|high|cash/i;

export function formatConflictValue(c: SyncConflict, value: string) {
  if (!value) return "Blank";
  const field = c.tab === "guardrails"
    ? GUARDRAILS.find(g => g.key === c.field)
    : TABS[c.tab as TabKey]?.fields.find(f => f.field === c.field);
  if (field?.type === "number" && Number.isFinite(Number(value))) return MONEY.test(c.label) ? money(Number(value)) : value;
  if (field?.type === "date") return shortDate(value);
  return value;
}

export function SyncPage() {
  const { state, syncNow, syncing, save } = useLab();
  const health = useSyncHealth();
  const [activity, setActivity] = useState<Activity | null>(null);

  // Refetch the activity log whenever a sync finishes or the conflict count changes.
  useEffect(() => {
    let alive = true;
    fetch("/api/sync", { cache: "no-store" })
      .then(r => (r.ok ? (r.json() as Promise<Activity>) : null))
      .then(d => { if (alive && d) setActivity(d); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [state?.sync.lastRunAt, state?.conflicts.length]);

  const sync = state?.sync;
  const missing = Object.entries(activity?.pendingMissing ?? {}).filter(([, n]) => (n ?? 0) > 0) as Array<[TabKey, number]>;

  const resolve = async (c: SyncConflict, choice: "site" | "sheet") => {
    await save({ op: "resolveConflict", id: c.id, choice });
    void syncNow();
  };

  return (
    <>
      <PageHeader
        eyebrow="Website + Google Sheets"
        title="Sync Activity"
        description="Two interfaces into one system. Edits flow both ways; anything that needs your judgment waits here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => void syncNow("setup")} disabled={syncing || !sync?.configured || health === "needs_authorization"}
              title="Re-checks the system columns, triggers, and the Score /100 formula">
              <Wrench /> Re-run Sheet Setup
            </Button>
            <Button className="rounded-full" onClick={() => void syncNow()} disabled={syncing || !sync?.configured}>
              <RefreshCw className={syncing ? "animate-spin" : ""} /> Sync Now
            </Button>
          </div>
        }
      />

      <section className={cn("sync-hero", `sync-hero-${health}`)}>
        <SyncDot health={health} />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{HEALTH_LABEL[health]}</p>
          <p className="text-sm text-muted-foreground">
            {sync?.lastSuccessAt ? `Last successful sync ${relativeTime(sync.lastSuccessAt)}` : "No successful sync yet"}
            {sync?.lastRunAt && sync.lastRunAt !== sync.lastSuccessAt ? ` · last attempt ${relativeTime(sync.lastRunAt)}` : ""}
          </p>
          {sync?.lastError && health !== "synced" && <p className="mt-1 text-sm">{sync.lastError}</p>}
        </div>
      </section>

      {health === "needs_authorization" && (
        <section className="auth-card">
          <KeyRound className="size-5 shrink-0" />
          <div>
            <h2 className="section-title">One-Time Google Authorization</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The sync service lives in your Google account as the Apps Script project “Income &amp; Venture Lab Sync”. Google needs you to approve it once:
            </p>
            <ol className="auth-steps">
              <li>Open the script editor{sync?.editorUrl ? "" : " (script id in .dev.vars)"}.</li>
              <li>Choose <code>setup</code> in the function menu and press <strong>Run</strong>.</li>
              <li>Approve access. Google warns the app is unverified because it is yours — choose <em>Advanced → Go to Income &amp; Venture Lab Sync</em>.</li>
              <li>Come back and press <strong>Check Again</strong>. The first sync links every row to its idea.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              {sync?.editorUrl && (
                <Button asChild className="rounded-full"><a href={sync.editorUrl} target="_blank" rel="noreferrer">Open Script Editor <ExternalLink /></a></Button>
              )}
              <Button variant="outline" className="rounded-full" onClick={() => void syncNow()} disabled={syncing}>Check Again</Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Until then the Lab runs on the workbook snapshot taken Sept. 14, 2026; your edits are kept and pushed once connected.</p>
          </div>
        </section>
      )}

      {health === "not_configured" && (
        <section className="auth-card">
          <KeyRound className="size-5 shrink-0" />
          <div>
            <h2 className="section-title">Connect Google Sheets</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add <code>GOOGLE_SHEETS_SYNC_URL</code> and <code>GOOGLE_SHEETS_SYNC_SECRET</code> to <code>.dev.vars</code> and restart the dev server. See the README for the Apps Script deployment.
            </p>
          </div>
        </section>
      )}

      {missing.map(([tab, n]) => (
        <section key={tab} className="missing-card">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{n} row{n === 1 ? "" : "s"} disappeared from {TABS[tab].label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Rows were removed from the sheet rather than archived with the <code>_deleted</code> checkbox. Nothing on the site was deleted. If the removal was intentional, confirm it; otherwise restore the rows in Sheets (version history works) and sync again.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <OpenInSheet tab={tab} label="Check Sheet" />
            <Button variant="destructive" className="rounded-full" onClick={() => void syncNow("acceptMissing", [tab])}>Confirm Removal</Button>
          </div>
        </section>
      ))}

      <section className="mt-10">
        <SectionHeader eyebrow="Needs a Decision" title="Conflicts"
          description="These values changed on the site and in Google Sheets since the last sync. Nothing was overwritten." />
        {state?.conflicts.length ? (
          <div className="conflict-grid">
            {state.conflicts.map(c => (
              <article key={c.id} className="conflict-card">
                <p className="card-kicker">{c.tab === "guardrails" ? "Start Here" : TABS[c.tab as TabKey]?.label} · {relativeTime(c.createdAt)}</p>
                <h3 className="mt-1 text-lg font-semibold">{c.label} Conflict</h3>
                <p className="text-sm text-muted-foreground">{c.title}</p>
                <div className="conflict-values">
                  <div><span>Site</span><strong>{formatConflictValue(c, c.siteValue)}</strong></div>
                  <div><span>Google Sheet</span><strong>{formatConflictValue(c, c.sheetValue)}</strong></div>
                </div>
                {c.baseValue && <p className="text-xs text-muted-foreground">Both started from {formatConflictValue(c, c.baseValue)}</p>}
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1 rounded-full" onClick={() => void resolve(c, "site")}>Use Site</Button>
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => void resolve(c, "sheet")}>Use Sheet</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No conflicts" text="When the same value changes in both places between syncs, it lands here instead of being silently overwritten." />
        )}
      </section>

      <section className="mt-12">
        <SectionHeader eyebrow="Mapped Tabs" title="Where Everything Lives" />
        <div className="table-wrap">
          <table className="lab-table compact">
            <thead><tr><th>Site Records</th><th>Workbook</th><th>Tab</th><th className="num">Linked Rows</th><th /></tr></thead>
            <tbody>
              {TAB_ORDER.map(key => (
                <tr key={key} className="cursor-default">
                  <td className="font-medium">{({ shortIdeas: "Short-term ideas", longIdeas: "Long-term ideas", experiments: "Experiments", sprint: "Sprint actions", plan: "Milestones", costs: "Expenses", investments: "Investment options", investmentExperiments: "Investment experiments" } as const)[key]}</td>
                  <td>{WORKBOOKS[TABS[key].workbook].short}</td>
                  <td>{sync?.sheets[key]?.sheetName ?? TABS[key].label}</td>
                  <td className="num">{Object.values(state?.sheetRows ?? {}).filter(list => list.some(r => r.tab === key)).length}</td>
                  <td className="text-right"><OpenInSheet tab={key} label="Open" variant="ghost" className="h-8 rounded-full" /></td>
                </tr>
              ))}
              <tr className="cursor-default">
                <td className="font-medium">Guardrails</td><td>{WORKBOOKS.long.short}</td><td>{sync?.sheets.guardrails?.sheetName ?? "Start Here"}</td><td className="num">—</td>
                <td className="text-right"><OpenInSheet tab="guardrails" label="Open" variant="ghost" className="h-8 rounded-full" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeader eyebrow="Debugging" title="Recent Sync Events" />
        {activity?.events.length ? (
          <ol className="event-list">
            {activity.events.map(e => (
              <li key={e.id} className={cn(e.status !== "ok" && `event-${e.status}`)}>
                <span className="event-dir" title={e.direction}>
                  {e.direction === "sheet→site" ? <ArrowRight className="size-3.5" /> : e.direction === "site→sheet" ? <ArrowLeft className="size-3.5" /> : e.direction === "both" ? <ArrowLeftRight className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{e.details}</span>
                  <span className="block text-xs text-muted-foreground">{e.direction === "sheet→site" ? "Sheet → Site" : e.direction === "site→sheet" ? "Site → Sheet" : e.direction === "both" ? "Both changed" : "System"} · {e.action}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(e.at)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="No sync events yet" text="Every row created, updated, archived, or conflicted in either direction is logged here." />
        )}
      </section>
    </>
  );
}
