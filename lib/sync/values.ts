export type FieldType = "text" | "number" | "date";

/**
 * Canonical string form used to compare site values, sheet values and sync baselines.
 * Must match `normCell_` in apps-script/Code.js exactly, or every sync would look like an edit.
 */
export function normalize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value * 10000) / 10000) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

export type Parsed = { ok: true; value: string | number | null } | { ok: false; raw: string };

/** Converts a raw cell value (as serialized by the Apps Script) into the site's typed value. */
export function parseSheetValue(raw: unknown, type: FieldType): Parsed {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: type === "text" ? "" : null };
  if (type === "text") {
    const text = String(raw).trim();
    return isSheetError(text) ? { ok: false, raw: text } : { ok: true, value: text };
  }
  if (type === "number") {
    if (typeof raw === "number") return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, raw: String(raw) };
    const text = String(raw).trim();
    if (isSheetError(text)) return { ok: false, raw: text };
    const cleaned = text.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
    const percent = cleaned.endsWith("%");
    const parsed = Number(percent ? cleaned.slice(0, -1) : cleaned);
    if (!Number.isFinite(parsed)) return { ok: false, raw: text };
    return { ok: true, value: percent ? parsed / 100 : parsed };
  }
  // date
  if (typeof raw === "number") return { ok: true, value: serialToIso(raw) };
  const text = String(raw).trim();
  if (isSheetError(text)) return { ok: false, raw: text };
  const iso = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : toIsoDate(text);
  return iso ? { ok: true, value: iso } : { ok: true, value: text };
}

export function isSheetError(text: string) {
  return /^#(REF|N\/A|VALUE|DIV\/0|NAME|NUM|NULL|ERROR)[!?]?/i.test(text);
}

function serialToIso(serial: number) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function toIsoDate(text: string) {
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
