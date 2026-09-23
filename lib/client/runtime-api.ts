const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzcOb6BTqpOjaJIpKDzDacrfW2BYZr1m8weymvNt91iuSsRcWS7aEShAYY1QLid2Xc-nQ/exec";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");

/** GitHub Pages site base path (vite.pages.config.ts base). */
const PAGES_BASE = "/income-venture-lab/";

type Pending = { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: number };
let frame: HTMLIFrameElement | null = null;
let bridgeWindow: Window | null = null;
let ready: Promise<void> | null = null;
let session = "";
const pending = new Map<string, Pending>();

function bridgeReady() {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    session = crypto.randomUUID();
    let timeout = 0;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.session !== session) return;
      if (event.data.type === "ivl-ready") {
        bridgeWindow = event.source as Window;
        window.clearTimeout(timeout);
        resolve();
        return;
      }
      if (event.data.type !== "ivl-result") return;
      const item = pending.get(event.data.id);
      if (!item) return;
      pending.delete(event.data.id);
      window.clearTimeout(item.timer);
      if (event.data.ok) item.resolve(event.data.value);
      else item.reject(new Error(event.data.error || "The data connection failed."));
    };

    // Install the listener before attaching the iframe. A cached Apps Script
    // bridge can announce itself during the same tick it is appended.
    window.addEventListener("message", onMessage);
    frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = "Income & Venture Lab data connection";
    frame.src = `${APPS_SCRIPT_URL}?mode=bridge&origin=${encodeURIComponent(window.location.origin)}&session=${encodeURIComponent(session)}`;
    timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      frame?.remove();
      frame = null;
      bridgeWindow = null;
      ready = null;
      reject(new Error("The Google Sheets connection did not respond. Refresh and try again."));
    }, 20_000);
    document.body.appendChild(frame);
  });
  return ready;
}

async function bridgeCall<T>(action: string, payload: Record<string, unknown> = {}, retries = 1): Promise<T> {
  try {
    await bridgeReady();
  } catch (error) {
    // Apps Script occasionally starts its embedded bridge slowly after a
    // deployment or a sleeping browser tab. Retry once with a fresh iframe so
    // the user does not have to refresh the whole Lab.
    if (retries > 0) return bridgeCall<T>(action, payload, retries - 1);
    throw error;
  }
  const id = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("The Google Sheets connection timed out."));
    }, 30_000);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    bridgeWindow!.postMessage({ type: "ivl-call", id, session, action, payload }, "*");
  });
}

async function localJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

/** Primary market-data path on GitHub Pages: static JSON refreshed by Actions. */
async function pagesMarketData<T>(force = false): Promise<T> {
  const url = `${PAGES_BASE}market-data.json${force ? `?t=${Date.now()}` : ""}`;
  return localJson<T>(url, { cache: "no-store" });
}

export const runtimeApi = {
  state: <T>() => IS_GITHUB_PAGES ? bridgeCall<T>("state") : localJson<T>("/api/state", { cache: "no-store" }),
  mutate: <T>(mutation: unknown) => IS_GITHUB_PAGES
    ? bridgeCall<T>("mutate", { mutation })
    : localJson<T>("/api/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mutation) }),
  sync: <T>(action: string, tabs?: unknown) => IS_GITHUB_PAGES
    ? bridgeCall<T>("sync", { action, tabs })
    : localJson<T>("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, tabs }) }),
  investmentData: async <T>(force = false): Promise<T> => {
    if (!IS_GITHUB_PAGES) {
      return localJson<T>(`/api/investment-data${force ? "?refresh=1" : ""}`, { cache: "no-store" });
    }
    // Primary: committed public/market-data.json (copied into Pages build).
    // Fallback: Apps Script bridge only if the static file cannot be loaded.
    try {
      return await pagesMarketData<T>(force);
    } catch {
      return bridgeCall<T>("investmentData", { force });
    }
  },
};
