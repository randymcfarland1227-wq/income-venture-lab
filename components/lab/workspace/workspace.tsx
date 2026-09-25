"use client";

import { useState } from "react";
import { ArrowLeft, Archive, ArchiveRestore, BriefcaseBusiness, LayoutList, MoreHorizontal, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_ACHIEVEMENT_STEPS, HORIZONS, INCOME_STYLES, MODULES, OPPORTUNITY_TYPES, STAGES, STATUS_SUGGESTIONS, VENTURE_TRACKS,
  defaultModules, includesLong, includesShort, relativeTime, type Idea, type ModuleKey,
} from "@/lib/domain";
import { TABS, type TabKey } from "@/lib/sync/tabs";
import { cn } from "@/lib/utils";
import { OpenInSheet } from "../sheet-link";
import { HEALTH_LABEL, SyncDot, useSyncHealth } from "../shell";
import { useLab } from "../store";
import { ActiveToggle } from "../tracking";
import { Editable, Empty } from "../ui";
import { useIdeaSave } from "./common";
import { OverviewModule } from "./overview";
import { CompetitionModule, MarketModule } from "./market";
import { BarriersModule, BuildModule, ModelModule } from "./model";
import { FinancialsModule } from "./financials";
import { ExperimentsModule, ResearchModule, RoadmapModule, ValidationModule } from "./evidence";
import { BrandModule, BusinessPlanModule, MarketingModule } from "./venture-strategy";

export function Workspace({ ideaId, module }: { ideaId: string; module?: string }) {
  const { data, go, back, update, archive, save } = useLab();
  const idea = data.ideaById.get(ideaId);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (!idea) {
    return <Empty title="Idea not found" text="It may have been removed in Google Sheets. Archived ideas can be restored from the sidebar."
      action={<Button className="mt-4 rounded-full" onClick={() => go("overview")}>Back to Overview</Button>} />;
  }

  const visible = defaultModules(idea);
  const active = (MODULES.some(m => m.key === module) ? module : "overview") as ModuleKey;
  const shown = visible.includes(active) ? visible : [...visible, active];
  const fallback = idea.ventureTrack === "Idea Vault" ? "ventures/vault" : idea.ventureTrack === "Venture Studio" ? "ventures/studio" : includesShort(idea.horizon) ? "short-term" : "long-term";

  const toggleModule = (key: ModuleKey, on: boolean) => {
    const next = on ? [...visible, key] : visible.filter(k => k !== key);
    const ordered = MODULES.map(m => m.key).filter(k => next.includes(k) || k === "overview");
    void update("ideas", idea.id, { details: { ...idea.details, modules: ordered } });
  };

  return (
    <div className="workspace">
      <Button variant="ghost" onClick={() => back(fallback)} className="-ml-3 mb-4 rounded-full"><ArrowLeft /> Back</Button>
      {idea.deletedAt && (
        <div className="archived-banner">
          <Archive className="size-4" /> This idea is archived. Its research, experiments, and history are kept.
          <Button size="sm" variant="outline" className="ml-auto rounded-full" onClick={() => void save({ op: "restore", collection: "ideas", id: idea.id })}>
            <ArchiveRestore /> Restore
          </Button>
        </div>
      )}
      <WorkspaceHeader idea={idea} onArchive={() => setConfirmArchive(true)} />

      <nav className="module-nav" aria-label="Workspace modules">
        {shown.map(key => (
          <button key={key} type="button" aria-current={active === key ? "page" : undefined}
            className={cn("module-tab", active === key && "active")} onClick={() => go(`idea/${idea.id}/${key}`)}>
            {MODULES.find(m => m.key === key)?.label}
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="module-tab more"><LayoutList className="size-3.5" /> Modules</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Show in This Workspace</DropdownMenuLabel>
            {MODULES.filter(m => m.key !== "overview").map(m => (
              <DropdownMenuCheckboxItem key={m.key} checked={visible.includes(m.key)} onCheckedChange={on => toggleModule(m.key, Boolean(on))}
                onSelect={e => e.preventDefault()}>
                {m.label}
              </DropdownMenuCheckboxItem>
            ))}
            {idea.details.modules?.length ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void update("ideas", idea.id, { details: { ...idea.details, modules: [] } })}>Reset to Suggested Modules</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="module-body">
        {active === "plan" ? <BusinessPlanModule idea={idea} />
          : active === "brand" ? <BrandModule idea={idea} />
          : active === "marketing" ? <MarketingModule idea={idea} />
          : active === "market" ? <MarketModule idea={idea} />
          : active === "competition" ? <CompetitionModule idea={idea} />
          : active === "model" ? <ModelModule idea={idea} />
          : active === "build" ? <BuildModule idea={idea} />
          : active === "financials" ? <FinancialsModule idea={idea} />
          : active === "barriers" ? <BarriersModule idea={idea} />
          : active === "validation" ? <ValidationModule idea={idea} />
          : active === "experiments" ? <ExperimentsModule idea={idea} />
          : active === "research" ? <ResearchModule idea={idea} />
          : active === "roadmap" ? <RoadmapModule idea={idea} />
          : <OverviewModule idea={idea} />}
      </div>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive “{idea.title}”?</DialogTitle>
            <DialogDescription>
              The idea leaves every section and its Sheet row is marked archived (<code>_deleted</code>). Research, experiments, and history are kept, and you can restore it any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>Keep It</Button>
            <Button variant="destructive" onClick={() => { setConfirmArchive(false); void archive("ideas", idea.id, idea.title); back(fallback); }}>Archive Idea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkspaceHeader({ idea, onArchive }: { idea: Idea; onArchive: () => void }) {
  const { state, go, update } = useLab();
  const save = useIdeaSave(idea);
  const health = useSyncHealth();
  const rows = (state?.sheetRows[idea.syncId] ?? []).filter(r => r.tab in TABS) as Array<{ tab: TabKey; row: number | null }>;
  const expected: TabKey[] = idea.ventureTrack ? [] : [...(includesShort(idea.horizon) ? ["shortIdeas" as const] : []), ...(includesLong(idea.horizon) ? ["longIdeas" as const] : [])];
  const conflicts = (state?.conflicts ?? []).filter(c => c.entityId === idea.id).length;
  const statuses = [...new Set([idea.status, ...STATUS_SUGGESTIONS].filter(Boolean))];
  // Falsy covers null/undefined/"" — older site records may omit ventureTrack.
  const canPromoteFromPipeline = !idea.ventureTrack;
  const canPromoteFromVault = idea.ventureTrack === "Idea Vault";
  const canPromote = canPromoteFromPipeline || canPromoteFromVault;
  const promoteLabel = canPromoteFromVault ? "Promote to Business and Brand Ideas" : "Move to Business and Brand Ideas";

  const promoteToBusinessAndBrand = async () => {
    const patch: Record<string, unknown> = { ventureTrack: "Venture Studio" };
    if (idea.stage === "Discover") patch.stage = "Validate";
    const existing = String(idea.details.achievementSteps ?? "").trim();
    if (!existing) {
      patch.details = { ...idea.details, achievementSteps: DEFAULT_ACHIEVEMENT_STEPS };
    }
    const ok = await update("ideas", idea.id, patch);
    if (ok) go("businesses/ideas");
  };

  return (
    <header className="workspace-head">
      <div className="min-w-0 flex-1">
        <div className="ws-meta">
          <MetaSelect label="Venture space" value={idea.ventureTrack || "Income Pipeline"} options={["Income Pipeline", ...VENTURE_TRACKS]}
            onSave={v => save.field("ventureTrack")(v === "Income Pipeline" ? null : v)} />
          <MetaSelect label="Horizon" value={idea.horizon} options={[...HORIZONS]} onSave={save.field("horizon")} />
          <MetaSelect label="Income style" value={idea.incomeStyle} options={[...INCOME_STYLES]} onSave={save.field("incomeStyle")} />
          <MetaSelect label="Opportunity type" value={idea.opportunityType} options={[...OPPORTUNITY_TYPES]} onSave={save.field("opportunityType")} />
          <MetaSelect label="Stage" value={idea.stage} options={[...STAGES]} onSave={save.field("stage")} />
          <MetaSelect label="Status" value={idea.status} options={statuses} onSave={save.field("status")} emphasis />
        </div>
        <div className="title-row">
          <Editable label="Idea name" hideLabel value={idea.title} onSave={v => { if (String(v ?? "").trim()) void save.field("title")(v); }} className="ws-title" />
          <ActiveToggle active={idea.active} onChange={next => update("ideas", idea.id, { active: next })} />
        </div>
        <Editable label="Description" hideLabel type="textarea" value={idea.description} onSave={save.field("description")}
          placeholder="Add a short description — why is this interesting?" className="ws-description" />
        {!idea.description && (idea.personalFitAngle || idea.howItEarns) && (
          <p className="ws-source-note"><span>From the workbook:</span> {idea.personalFitAngle || idea.howItEarns}</p>
        )}
        {canPromote && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={() => void promoteToBusinessAndBrand()}>
              {canPromoteFromVault ? <Rocket /> : <BriefcaseBusiness />} {promoteLabel}
            </Button>
          </div>
        )}
      </div>
      <aside className="ws-side">
        <div className="ws-sync">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SyncDot health={conflicts ? "conflict" : health} /> {conflicts ? `${conflicts} Conflict${conflicts === 1 ? "" : "s"}` : HEALTH_LABEL[health]}
          </span>
          <span className="text-xs text-muted-foreground">
            {idea.source === "site" ? "Created on the site" : idea.sourceSheet ? `From ${idea.sourceSheet}` : "Imported"} · updated {relativeTime(idea.updatedAt)}
          </span>
          {conflicts > 0 && <button type="button" className="text-left text-xs font-semibold underline" onClick={() => go("sync")}>Resolve in Sync Activity</button>}
        </div>
        <div className="grid gap-2">
          {(rows.length ? rows : expected.map(tab => ({ tab, row: null }))).map(r => (
            <OpenInSheet key={r.tab} tab={r.tab} row={r.row} label={`Open in ${TABS[r.tab].label}`} className="w-full justify-between rounded-full" />
          ))}
          {!rows.length && expected.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {idea.source === "snapshot" ? "Links to its live Sheet row on the first sync." : "Its Sheet row is added on the next sync."}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="self-start"><MoreHorizontal /> More</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPromote && (
              <DropdownMenuItem onSelect={() => void promoteToBusinessAndBrand()}>
                {canPromoteFromVault ? <Rocket /> : <BriefcaseBusiness />} {promoteLabel}
              </DropdownMenuItem>
            )}
            {canPromote && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={onArchive} className="text-destructive"><Archive /> Archive Idea…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
    </header>
  );
}

function MetaSelect({ label, value, options, onSave, emphasis }: { label: string; value: string; options: string[]; onSave: (v: string) => unknown; emphasis?: boolean }) {
  return (
    <label className={cn("meta-select", emphasis && "emphasis")} title={label}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={e => void onSave(e.target.value)} aria-label={label}>
        {!options.includes(value) && <option value={value}>{value || "—"}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
