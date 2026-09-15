import { env } from "cloudflare:workers";
import type { TabKey } from "@/lib/sync/tabs";

export type PulledRow = {
  row: number;
  syncId: string;
  deleted: boolean;
  version: number;
  updatedAt: string;
  source: string;
  values: Record<string, unknown>;
};

export type PulledTab = {
  key: TabKey;
  found: boolean;
  sheetName?: string;
  gid?: number;
  headerRow?: number;
  headers?: string[];
  formulaHeaders?: string[];
  rows?: PulledRow[];
  error?: string;
};

export type PulledGuardrails = { found: boolean; sheetName?: string; gid?: number; values?: Record<string, unknown> };

export type PullResponse = { ok: true; pulledAt: string; tabs: PulledTab[]; guardrails: PulledGuardrails };

export type WriteOp = {
  tab: TabKey;
  op: "upsert" | "markDeleted" | "restore" | "reassign";
  syncId: string;
  values?: Record<string, unknown>;
  expect?: Record<string, string>;
  restore?: boolean;
  reason?: string;
  row?: number;
  newSyncId?: string;
};

export type WriteResult = {
  tab: TabKey;
  syncId: string;
  op: WriteOp["op"];
  ok: boolean;
  row?: number;
  created?: boolean;
  missing?: boolean;
  conflicts?: Array<{ header: string; sheetValue: unknown }>;
  assigned?: Record<string, unknown>;
  newSyncId?: string;
  error?: string;
};

export type GuardrailWrite = { values: Record<string, unknown>; expect: Record<string, string> };

export type WriteResponse = {
  ok: true;
  results: WriteResult[];
  guardrails: { ok: boolean; conflicts?: Array<{ header: string; sheetValue: unknown }>; error?: string } | null;
};

/** The web app answered with Google's sign-in/consent page instead of JSON. */
export class SheetsAuthError extends Error {}

export function sheetsConfig() {
  const url = env.GOOGLE_SHEETS_SYNC_URL ?? "";
  const secret = env.GOOGLE_SHEETS_SYNC_SECRET ?? "";
  const scriptId = env.GOOGLE_SHEETS_SCRIPT_ID ?? "";
  return {
    url,
    secret,
    configured: Boolean(url && secret),
    editorUrl: scriptId ? `https://script.google.com/d/${scriptId}/edit` : null,
  };
}

export async function callSheets<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { url, secret, configured } = sheetsConfig();
  if (!configured) throw new Error("Google Sheets sync is not configured.");

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, action, ...payload }),
    redirect: "follow",
  });
  const text = await response.text();

  let data: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    if (response.status === 401 || response.status === 403 || /<html/i.test(text)) {
      throw new SheetsAuthError("Google needs a one-time authorization for the sync script. Open the script editor and run setup.");
    }
    throw new Error(`Google Sheets sync returned an unexpected response (${response.status}).`);
  }
  if (!data.ok) {
    if (data.error === "unauthorized") throw new Error("The sync secret does not match the Apps Script. Redeploy it with apps-script/deploy.sh.");
    throw new Error(data.error || "Google Sheets sync failed.");
  }
  return data as T;
}
