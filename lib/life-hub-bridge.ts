/** Life Hub postMessage bridge — source id `income`. See frontier LIFE_HUB.md. */

import type { AppState, Experiment, Idea, SprintAction } from "@/lib/domain";

/** Allowed Life Hub parent origins (GitHub Pages primary + legacy Worker). */
export const LIFE_HUB_ORIGINS = [
  "https://randymcfarland1227-wq.github.io",
  "https://frontier-work-room.randymcfarland1227.workers.dev",
] as const;
export const LIFE_HUB_ORIGIN = LIFE_HUB_ORIGINS[0];
export const INCOME_SOURCE = "income" as const;
const ORIGIN_URL = "https://randymcfarland1227-wq.github.io/income-venture-lab/";

export function isLifeHubOrigin(origin: string) {
  return (LIFE_HUB_ORIGINS as readonly string[]).includes(origin);
}
const STAR_KEY = "income-lab.lifeHubStars";

export type LifeHubFeatured = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  originUrl?: string;
  completable?: boolean;
};

export type LifeHubTask = {
  id: string;
  title: string;
  detail?: string;
  status?: string;
  due?: string;
  starred?: boolean;
  originUrl?: string;
};

export type LifeHubSnapshot = {
  source: typeof INCOME_SOURCE;
  metrics: Record<string, number>;
  featured: LifeHubFeatured[];
  tasks: LifeHubTask[];
  refreshedAt: string;
};

type StarStore = Record<string, boolean>;

function readStars(): StarStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STAR_KEY) || "{}") as StarStore;
  } catch {
    return {};
  }
}

function writeStars(stars: StarStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STAR_KEY, JSON.stringify(stars));
}

export function isIncomeStarred(id: string) {
  return Boolean(readStars()[id]);
}

export function setIncomeStarred(id: string, starred: boolean) {
  const stars = readStars();
  if (starred) stars[id] = true;
  else delete stars[id];
  writeStars(stars);
}

const DONE_SPRINT = new Set(["done", "complete", "completed", "skipped"]);
const DONE_EXPERIMENT = new Set(["complete", "completed", "stopped", "paused"]);
const ACTIVE_IDEA = new Set(["exploring", "shortlist", "consider", "research", "testing", "validated", "building", "earning"]);

function sprintOpen(s: SprintAction) {
  return !DONE_SPRINT.has(String(s.status || "").trim().toLowerCase());
}

function experimentOpen(e: Experiment) {
  return !DONE_EXPERIMENT.has(String(e.status || "").trim().toLowerCase());
}

function ideaActive(i: Idea) {
  const status = String(i.status || "").trim().toLowerCase();
  if (!status) return true;
  if (status === "paused" || status === "avoid for now" || status === "no" || status === "archived") return false;
  return ACTIVE_IDEA.has(status) || !DONE_SPRINT.has(status);
}

type TaskRow = LifeHubTask & { completable: boolean; collection?: "sprint" | "experiments" | "ideas" };

function collectTasks(state: AppState): TaskRow[] {
  const stars = readStars();
  const rows: TaskRow[] = [];

  state.sprint.filter(sprintOpen).forEach(s => {
    const id = `sprint:${s.id}`;
    rows.push({
      id,
      title: s.action || "Sprint action",
      detail: s.deliverable || s.successSignal || undefined,
      status: "open",
      due: s.day || undefined,
      starred: Boolean(stars[id]),
      originUrl: ORIGIN_URL,
      completable: true,
      collection: "sprint",
    });
  });

  state.experiments.filter(experimentOpen).forEach(e => {
    const id = `experiment:${e.id}`;
    rows.push({
      id,
      title: e.name || e.testAction || "Experiment",
      detail: e.hypothesis || e.ideaLabel || undefined,
      status: String(e.status || "open").toLowerCase() === "running" ? "open" : "open",
      due: e.decisionDate || e.startDate || undefined,
      starred: Boolean(stars[id]),
      originUrl: `${ORIGIN_URL}#/experiments`,
      completable: true,
      collection: "experiments",
    });
  });

  state.ideas.filter(ideaActive).forEach(i => {
    const id = `idea:${i.id}`;
    rows.push({
      id,
      title: i.title || "Idea",
      detail: i.firstTest || i.notes || undefined,
      status: "open",
      starred: Boolean(stars[id]),
      originUrl: `${ORIGIN_URL}#/idea/${encodeURIComponent(i.id)}`,
      completable: false,
      collection: "ideas",
    });
  });

  return rows;
}

export function buildIncomeSnapshot(state: AppState): LifeHubSnapshot {
  const rows = collectTasks(state);
  const activeVentures = state.ideas.filter(i => {
    const s = String(i.status || "").toLowerCase();
    return s === "building" || s === "earning" || s === "testing" || s === "validated";
  }).length;
  const revenueTracks = state.experiments.filter(e => Number(e.revenue || 0) > 0).length
    + state.ideas.filter(i => String(i.status || "").toLowerCase() === "earning").length;

  const tasks: LifeHubTask[] = rows.map(({ completable: _c, collection: _col, ...task }) => task);
  const featured: LifeHubFeatured[] = rows
    .filter(r => r.starred)
    .map(r => ({
      id: r.id,
      title: r.title,
      detail: r.detail || r.status || "",
      meta: r.collection === "sprint" ? "Sprint" : r.collection === "experiments" ? "Experiment" : "Idea",
      originUrl: r.originUrl,
      completable: r.completable,
    }));

  return {
    source: INCOME_SOURCE,
    metrics: {
      active: activeVentures,
      ideas: state.ideas.filter(ideaActive).length,
      revenue: revenueTracks,
    },
    featured,
    tasks,
    refreshedAt: new Date().toISOString(),
  };
}

export function postIncomeSnapshot(state: AppState, target?: MessageEventSource | null, origin = LIFE_HUB_ORIGIN) {
  const message = { type: "randys-workroom:snapshot" as const, payload: buildIncomeSnapshot(state) };
  const fanout = origin === LIFE_HUB_ORIGIN ? [...LIFE_HUB_ORIGINS] : [origin];
  try {
    if (target && "postMessage" in target) (target as Window).postMessage(message, { targetOrigin: origin });
  } catch { /* ignore */ }
  for (const o of fanout) {
    try {
      if (window.opener && !window.opener.closed) window.opener.postMessage(message, o);
    } catch { /* ignore */ }
    try {
      if (window.parent !== window) window.parent.postMessage(message, o);
    } catch { /* ignore */ }
  }
}

type BridgeHandlers = {
  getState: () => AppState | null;
  /** Persist domain mutations when complete hits a sprint/experiment. */
  completeRecord?: (collection: "sprint" | "experiments", id: string) => Promise<void> | void;
  onSnapshot?: () => void;
};

export function attachIncomeLifeHubBridge(handlers: BridgeHandlers) {
  const onMessage = async (event: MessageEvent) => {
    if (!isLifeHubOrigin(event.origin)) return;
    const type = event.data?.type;
    if (type === "randys-workroom:request") {
      const state = handlers.getState();
      if (state) postIncomeSnapshot(state, event.source, event.origin);
      return;
    }
    const payload = event.data?.payload || {};
    if (payload.source && payload.source !== INCOME_SOURCE) return;
    const rawId = String(payload.id || "");
    if (!rawId) return;

    if (type === "randys-workroom:star") {
      const want = typeof payload.starred === "boolean" ? payload.starred : !isIncomeStarred(rawId);
      setIncomeStarred(rawId, want);
      const state = handlers.getState();
      if (state) postIncomeSnapshot(state, event.source, event.origin);
      handlers.onSnapshot?.();
      return;
    }

    if (type === "randys-workroom:complete") {
      if (rawId.startsWith("sprint:") && handlers.completeRecord) {
        await handlers.completeRecord("sprint", rawId.slice("sprint:".length));
      } else if (rawId.startsWith("experiment:") && handlers.completeRecord) {
        await handlers.completeRecord("experiments", rawId.slice("experiment:".length));
      }
      // Ideas are not completable from the hub; unstar only.
      setIncomeStarred(rawId, false);
      const state = handlers.getState();
      if (state) postIncomeSnapshot(state, event.source, event.origin);
      handlers.onSnapshot?.();
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
