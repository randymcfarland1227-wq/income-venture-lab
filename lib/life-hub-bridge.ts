/** Life Hub postMessage bridge — source id `income`. See frontier LIFE_HUB.md. */

import type { AppState, LabTask } from "@/lib/domain";

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
  tag?: string;
};

export type LifeHubTask = {
  id: string;
  title: string;
  detail?: string;
  status?: string;
  due?: string;
  starred?: boolean;
  originUrl?: string;
  completedAt?: string;
  tag?: string;
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

type TrackCollection = "ideas" | "investments";
type TrackItem = { id: string; name: string; active: boolean; tasks: LabTask[]; collection: TrackCollection; deleted: boolean };

/** Businesses, opportunities, ideas & inventions (ideas) plus investments — each with its own task list. */
function trackItems(state: AppState): TrackItem[] {
  return [
    ...state.ideas.map(i => ({
      id: i.id, name: i.title || "Untitled", active: Boolean(i.active), tasks: i.tasks ?? [],
      collection: "ideas" as const, deleted: Boolean(i.deletedAt),
    })),
    ...state.investments.map(o => ({
      id: o.id, name: o.name || "Investment", active: Boolean(o.active), tasks: o.tasks ?? [],
      collection: "investments" as const, deleted: Boolean(o.deletedAt),
    })),
  ].filter(item => !item.deleted);
}

/** Life Hub id for one task on one item: task:<collection>:<itemId>:<taskId> */
const taskHubId = (item: TrackItem, taskId: string) => `task:${item.collection}:${item.id}:${taskId}`;

function parseTaskHubId(id: string): { collection: TrackCollection; itemId: string; taskId: string } | null {
  const m = id.match(/^task:(ideas|investments):([^:]+):(.+)$/);
  return m ? { collection: m[1] as TrackCollection, itemId: m[2], taskId: m[3] } : null;
}

/** Short item name shown as the tag in front of each task on Life Hub. */
function tagFor(name: string) {
  return name.length > 22 ? `${name.slice(0, 21).trimEnd()}…` : name;
}

const DONE_WINDOW_DAYS = 7;

export function buildIncomeSnapshot(state: AppState): LifeHubSnapshot {
  const stars = readStars();
  const items = trackItems(state);
  const active = items.filter(i => i.active);
  const cutoff = Date.now() - DONE_WINDOW_DAYS * 86400000;

  const tasks: LifeHubTask[] = [];
  const featured: LifeHubFeatured[] = [];
  for (const item of active) {
    const url = `${ORIGIN_URL}#/${item.collection === "investments" ? "investment" : "idea"}/${encodeURIComponent(item.id)}`;
    for (const t of item.tasks) {
      const id = taskHubId(item, t.id);
      if (t.done) {
        // Recently finished in the lab — Life Hub records each once as a completion.
        const at = t.doneAt ? Date.parse(t.doneAt) : NaN;
        if (Number.isFinite(at) && at >= cutoff) {
          tasks.push({ id, title: t.text, detail: item.name, status: "done", completedAt: t.doneAt ?? undefined, originUrl: url, tag: tagFor(item.name) });
        }
        continue;
      }
      const starred = Boolean(stars[id]);
      tasks.push({ id, title: t.text, detail: item.name, status: "open", starred, originUrl: url, tag: tagFor(item.name) });
      if (starred) {
        featured.push({ id, title: t.text, detail: item.name, meta: item.collection === "investments" ? "Investment" : "Venture", originUrl: url, completable: true, tag: tagFor(item.name) });
      }
    }
  }

  return {
    source: INCOME_SOURCE,
    metrics: {
      // Open tasks on active items (Life Hub shows this as its to-do count)
      activeTasks: tasks.filter(t => t.status === "open").length,
      active: active.length,
      // Investments are left out of "not active" on purpose
      inactive: items.filter(i => !i.active && i.collection === "ideas").length,
    },
    featured,
    tasks,
    refreshedAt: new Date().toISOString(),
  };
}

export function postIncomeSnapshot(state: AppState, target?: MessageEventSource | null, origin: string = LIFE_HUB_ORIGIN) {
  const message = { type: "randys-workroom:snapshot" as const, payload: buildIncomeSnapshot(state) };
  const fanout: string[] = origin === LIFE_HUB_ORIGIN ? [...LIFE_HUB_ORIGINS] : [origin];
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
  /** Mark one task on an idea / investment done (Life Hub "Done"). */
  completeTask?: (collection: "ideas" | "investments", itemId: string, taskId: string) => Promise<void> | void;
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
      const ref = parseTaskHubId(rawId);
      if (ref && handlers.completeTask) await handlers.completeTask(ref.collection, ref.itemId, ref.taskId);
      setIncomeStarred(rawId, false);
      const state = handlers.getState();
      if (state) postIncomeSnapshot(state, event.source, event.origin);
      handlers.onSnapshot?.();
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
