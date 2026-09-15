"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  Archive, BarChart3, BriefcaseBusiness, CircleDollarSign, FlaskConical, Gauge, Landmark, LibraryBig, Loader2, Plus,
  RefreshCw, Search, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { relativeTime, type SyncHealth } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useLab } from "./store";

export const NAV = [
  { path: "overview", label: "Overview", icon: Gauge },
  { path: "short-term", label: "Short-Term Income", icon: CircleDollarSign },
  { path: "ventures", label: "Business & Ventures", icon: BriefcaseBusiness },
  { path: "passive", label: "Passive Income", icon: Sparkles },
  { path: "long-term", label: "Long-Term Income", icon: Landmark },
  { path: "experiments", label: "Experiments", icon: FlaskConical },
  { path: "financials", label: "Income & Financials", icon: BarChart3 },
  { path: "discovery", label: "Discovery Library", icon: LibraryBig },
] as const;

export const HEALTH_LABEL: Record<SyncHealth, string> = {
  synced: "Synced",
  syncing: "Syncing",
  issue: "Sync Issue",
  conflict: "Conflict",
  needs_authorization: "Needs Google Access",
  not_configured: "Sheets Not Connected",
};

export function useSyncHealth(): SyncHealth {
  const { state, syncing } = useLab();
  if (syncing && state?.sync.configured && state.sync.health !== "needs_authorization") return "syncing";
  return state?.sync.health ?? "syncing";
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <LabSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <Header />
        <main className="lab-main">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function LabSidebar() {
  const { route, section, go, state } = useLab();
  const { setOpenMobile, isMobile } = useSidebar();
  // Keep the originating section highlighted while an idea workspace is open.
  const active = route.page === "idea" ? section : route.page;

  const navigate = (path: string) => {
    go(path);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <SidebarHeader className="px-5 pb-4 pt-6">
        <button type="button" onClick={() => navigate("overview")} className="brand">
          <span className="brand-mark" aria-hidden>IV</span>
          <span className="text-left">
            <span className="brand-name">Income &amp; Venture</span>
            <span className="brand-sub">Lab</span>
          </span>
        </button>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map(({ path, label, icon: Icon }) => (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton isActive={active === path} onClick={() => navigate(path)} className="nav-button">
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 p-4">
        <SyncCard onNavigate={navigate} />
        {Boolean(state?.ideas.some(i => i.deletedAt)) && (
          <button type="button" className="sidebar-link" onClick={() => navigate("archive")}>
            <Archive className="size-3.5" /> Archived Ideas
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function SyncCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { state, syncNow, syncing } = useLab();
  const health = useSyncHealth();
  const sync = state?.sync;
  const detail = !sync ? "Loading…"
    : health === "not_configured" ? "Add the sync URL to .dev.vars"
    : health === "needs_authorization" ? "Run setup once in Apps Script"
    : health === "conflict" ? `${sync.openConflicts} value${sync.openConflicts === 1 ? "" : "s"} need a decision`
    : health === "issue" ? sync.lastError ?? "See Sync Activity"
    : `2 workbooks · ${sync.lastSuccessAt ? `synced ${relativeTime(sync.lastSuccessAt)}` : "first sync pending"}`;

  return (
    <div className="sync-card">
      <button type="button" className="sync-card-main" onClick={() => onNavigate("sync")}>
        <span className="flex items-center gap-2 text-xs font-semibold">
          <SyncDot health={health} /> {HEALTH_LABEL[health]}
        </span>
        <span className="sync-card-detail">{detail}</span>
      </button>
      <button type="button" className="sync-card-action" onClick={() => void syncNow()} disabled={syncing || !sync?.configured}
        aria-label="Sync now" title="Sync now">
        <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
      </button>
    </div>
  );
}

export function SyncDot({ health }: { health: SyncHealth }) {
  if (health === "syncing") return <Loader2 className="size-3 animate-spin" aria-hidden />;
  return <span className={cn("sync-dot", `sync-${health}`)} aria-hidden />;
}

function Header() {
  const { setAddIdeaOpen, setSearchOpen, go, state } = useLab();
  const health = useSyncHealth();
  const shortcut = useSyncExternalStore(
    () => () => undefined,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );

  return (
    <header className="lab-header">
      <SidebarTrigger className="md:hidden" />
      <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}>
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search ideas, research, competitors…</span>
        <kbd className="search-kbd">{shortcut}</kbd>
      </button>
      <button type="button" className={cn("sync-pill", `sync-pill-${health}`)} onClick={() => go("sync")}
        title={state?.sync.lastError ?? undefined}>
        <SyncDot health={health} />
        <span className="hidden lg:inline">{HEALTH_LABEL[health]}</span>
      </button>
      <Button onClick={() => setAddIdeaOpen(true)} className="add-idea-button">
        <Plus />
        <span className="hidden sm:inline">Add Idea</span>
      </Button>
    </header>
  );
}
