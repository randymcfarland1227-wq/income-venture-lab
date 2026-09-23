"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AppState, Collection } from "@/lib/domain";
import type { Mutation } from "@/lib/server/repo";
import type { TabKey } from "@/lib/sync/tabs";
import { derive, type Derived } from "./derive";
import { runtimeApi } from "@/lib/client/runtime-api";
import { attachIncomeLifeHubBridge, postIncomeSnapshot } from "@/lib/life-hub-bridge";

export type Route = { page: string; sub?: string; id?: string; module?: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "idea") return { page: "idea", id: parts[1], module: parts[2] };
  if (parts[0] === "investment") return { page: "investment", id: parts[1], module: parts[2] };
  return { page: parts[0] || "overview", sub: parts[1] };
}

type SyncAction = "run" | "acceptMissing" | "setup";

type LabContextValue = {
  state: AppState | null;
  data: Derived;
  error: string | null;
  route: Route;
  /** The last non-workspace page, so the sidebar can keep it highlighted inside an idea. */
  section: string;
  go: (path: string) => void;
  /** Leave an idea workspace for the section the user came from (or `fallback`). */
  back: (fallback: string) => void;
  syncing: boolean;
  syncNow: (action?: SyncAction, tabs?: TabKey[]) => Promise<void>;
  save: (m: Mutation) => Promise<{ id?: string } | null>;
  create: (collection: Collection, data: Record<string, unknown>) => Promise<string | null>;
  update: (collection: Collection, id: string, data: Record<string, unknown>) => Promise<boolean>;
  archive: (collection: Collection, id: string, label: string) => Promise<void>;
  addIdeaOpen: boolean;
  setAddIdeaOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
};

const LabContext = createContext<LabContextValue | null>(null);

export function useLab() {
  const value = useContext(LabContext);
  if (!value) throw new Error("useLab must be used inside <LabProvider>");
  return value;
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ page: "overview" });
  const [syncing, setSyncing] = useState(false);
  const [addIdeaOpen, setAddIdeaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastSync = useRef(0);
  // Bumped by every edit; a sync that started before an edit must not overwrite it.
  const editSeq = useRef(0);

  const lastOutside = useRef<string | null>(null);
  const [section, setSection] = useState("overview");

  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash);
      if (next.page !== "idea" && next.page !== "investment") {
        lastOutside.current = window.location.hash.replace(/^#\/?/, "") || "overview";
        setSection(next.page);
      }
      setRoute(next);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((path: string) => {
    const next = `#/${path.replace(/^#?\/?/, "")}`;
    if (window.location.hash !== next) window.location.hash = next;
    else setRoute(parseHash(next));
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback((fallback: string) => go(lastOutside.current ?? fallback), [go]);

  const load = useCallback(async () => {
    try {
      const data = await runtimeApi.state<AppState>();
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the lab.");
    }
  }, []);

  const syncNow = useCallback(async (action: SyncAction = "run", tabs?: TabKey[]) => {
    if (inFlight.current && action === "run") return inFlight.current;
    const startedAt = editSeq.current;
    const run = (async () => {
      setSyncing(true);
      try {
        const data = await runtimeApi.sync<{ state: AppState; result?: { ok: boolean; error?: string; fromSheet: number; toSheet: number }; setupLog?: string[] }>(action, tabs);
        if (editSeq.current === startedAt) setState(data.state);
        else void load();
        if (action === "setup" && data.setupLog) toast.success("Sheet setup finished", { description: data.setupLog.slice(0, 3).join(" · ") });
        if (action === "acceptMissing") toast.success("Removed rows confirmed");
        if (action !== "run" && data.result && !data.result.ok && data.result.error) toast.error(data.result.error);
      } catch (e) {
        if (action !== "run") toast.error(e instanceof Error ? e.message : "Sync failed.");
      } finally {
        lastSync.current = Date.now();
        setSyncing(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [load]);

  const scheduleSync = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void syncNow(), 1500);
  }, [syncNow]);

  const save = useCallback(async (m: Mutation) => {
    editSeq.current++;
    try {
      const data = await runtimeApi.mutate<{ id?: string; state: AppState }>(m);
      setState(data.state);
      scheduleSync();
      return { id: data.id };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
      return null;
    }
  }, [scheduleSync]);

  const create = useCallback(async (collection: Collection, data: Record<string, unknown>) => {
    const result = await save({ op: "create", collection, data });
    return result?.id ?? null;
  }, [save]);

  const update = useCallback(async (collection: Collection, id: string, data: Record<string, unknown>) => {
    return Boolean(await save({ op: "update", collection, id, data }));
  }, [save]);

  const archive = useCallback(async (collection: Collection, id: string, label: string) => {
    const ok = await save({ op: "delete", collection, id });
    if (ok) {
      toast(`Archived “${label}”`, {
        action: { label: "Undo", onClick: () => void save({ op: "restore", collection, id }) },
      });
    }
  }, [save]);

  // Paint the saved state immediately. If it is stale, reconcile in the
  // background so an old browser session never remains hours behind Sheets.
  useEffect(() => {
    let alive = true;
    runtimeApi.state<AppState>()
      .then(data => {
        if (!alive) return;
        const savedAt = Date.parse(data.sync?.lastSuccessAt ?? "") || 0;
        lastSync.current = savedAt;
        setState(data);
        if (Date.now() - savedAt > 5 * 60_000) {
          window.setTimeout(() => {
            if (alive) void syncNow();
          }, 250);
        }
      })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Could not load the lab."); });
    return () => { alive = false; };
  }, [syncNow]);

  // Periodic reconciliation while the Lab is open, plus a catch-up when the window returns.
  useEffect(() => {
    // A sync request also initializes the database. Do not race it against the
    // initial state request on a brand-new deployment.
    if (!state) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncNow();
    }, 60_000);
    const onFocus = () => {
      if (Date.now() - lastSync.current > 20_000) void syncNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync.current > 20_000) void syncNow();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state, syncNow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(open => !open);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Life Hub bridge — sprint/experiments complete via store mutations; stars in localStorage.
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => attachIncomeLifeHubBridge({
    getState: () => stateRef.current,
    completeRecord: async (collection, id) => {
      if (collection === "sprint") {
        await updateRef.current("sprint", id, { status: "Done" });
      } else {
        await updateRef.current("experiments", id, { status: "Complete" });
      }
    },
  }), []);
  useEffect(() => {
    if (state) postIncomeSnapshot(state);
  }, [state]);

  const data = useMemo(() => derive(state), [state]);

  const value = useMemo<LabContextValue>(() => ({
    state, data, error, route, section, go, back, syncing, syncNow, save, create, update, archive,
    addIdeaOpen, setAddIdeaOpen, searchOpen, setSearchOpen,
  }), [state, data, error, route, section, go, back, syncing, syncNow, save, create, update, archive, addIdeaOpen, searchOpen]);

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
