/**
 * In-memory stand-in for the Apps Script sync service (apps-script/Code.js), for local
 * testing only. It speaks the same pull/write contract — header-keyed rows, system columns,
 * formula columns that are never written, slot rows in the 12-Month Plan, `expect` checks —
 * plus a few /__ control endpoints that simulate someone editing the Sheets by hand.
 *
 *   MOCK_SECRET=test node scripts/mock-sheets.mjs        # listens on :8911
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 8911);
const SECRET = process.env.MOCK_SECRET || "test-secret";
const HEADER_ROW = 4;
const SYSTEM = ["_sync_id", "_updated_at", "_version", "_deleted", "_source"];

const normCell = v => (v === null || v === undefined || v === "" ? ""
  : typeof v === "number" ? String(Math.round(v * 1e4) / 1e4)
  : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v).trim());

const DEF = {
  shortIdeas: {
    sheetName: "Income Ideas", gid: 302757590, keys: ["opportunity"], autoIncrement: "id",
    headers: ["id", "status", "tier", "category", "opportunity", "personal fit / angle", "first cash", "startup cost", "weekly hrs", "income model", "low monthly", "high monthly", "speed 1-5", "fit 1-5", "demand 1-5", "scale 1-5", "low cost 1-5", "low risk 1-5", "score /100", "first test"],
    formulas: {
      "score /100": v => {
        const dims = ["speed 1-5", "fit 1-5", "demand 1-5", "scale 1-5", "low cost 1-5", "low risk 1-5"].map(h => Number(v[h]));
        return dims.every(n => n > 0) ? Math.round((dims.reduce((a, b) => a + b, 0) / 30) * 100) : "";
      },
    },
  },
  experiments: {
    sheetName: "Short Term Income Tracker", gid: 11, keys: ["idea", "hypothesis", "test action"],
    headers: ["idea", "status", "start date", "decision date", "hypothesis", "test action", "budget", "hours", "leads", "replies", "sales", "revenue", "direct cost", "net cash", "net $/hr", "decision / learning"],
    formulas: {
      "net cash": v => (Number(v.revenue) || 0) - (Number(v["direct cost"]) || 0),
      "net $/hr": v => (Number(v.hours) > 0 ? ((Number(v.revenue) || 0) - (Number(v["direct cost"]) || 0)) / Number(v.hours) : ""),
    },
  },
  sprint: {
    sheetName: "Actualizing Template", gid: 12, keys: ["action", "deliverable"],
    headers: ["day", "status", "action", "deliverable", "time", "cost cap", "success signal", "result / notes"], formulas: {},
  },
  longIdeas: {
    sheetName: "Income Options", gid: 126322697, keys: ["income path"],
    headers: ["category", "income path", "how it earns", "style", "startup low", "startup high", "monthly cost", "weeks to first $", "hours / week", "monthly income low", "monthly income high", "skill fit 1-5", "interest 1-5", "risk comfort 1-5", "passive potential 1-5", "setup effort 1-5", "ongoing effort 1-5", "sales effort 1-5", "complexity 1-5", "overall effort 1-5", "fit score /100", "status", "first low-cost test", "notes"],
    formulas: {
      "overall effort 1-5": v => {
        const e = ["setup effort 1-5", "ongoing effort 1-5", "sales effort 1-5", "complexity 1-5"].map(h => Number(v[h])).filter(n => n > 0);
        return e.length ? Math.round((e.reduce((a, b) => a + b, 0) / e.length) * 100) / 100 : "";
      },
      "fit score /100": v => Math.round(40 + (Number(v["skill fit 1-5"]) || 0) * 4 + (Number(v["interest 1-5"]) || 0) * 3 + (Number(v["passive potential 1-5"]) || 0) * 2),
    },
  },
  plan: {
    sheetName: "12-Month Plan", gid: 13, keys: ["income path", "milestone / hypothesis"], slots: true,
    headers: ["month", "income path", "stage", "milestone / hypothesis", "target date", "time budget hrs", "spending cap", "target monthly income", "actual monthly income", "status", "next action", "evidence / decision notes"], formulas: {},
  },
  costs: {
    sheetName: "Cost Planner", gid: 14, keys: ["income path", "expense item"],
    headers: ["income path", "expense category", "cost type", "expense item", "low estimate", "high estimate", "actual", "essential?", "due / start date", "notes / vendor"], formulas: {},
  },
  investments: {
    sheetName: "Investing & Assets", gid: 15, keys: ["investment / account"],
    headers: ["status", "classification", "category", "investment / account", "symbol / series", "account or asset", "definition", "how it earns", "typical horizon", "liquidity", "income frequency", "market risk", "principal risk", "credit risk", "interest rate risk", "inflation risk", "complexity", "passive level", "minimum / access notes", "fees / expense notes", "tax / account notes", "benchmark", "current metric", "current value", "observation date", "data source", "ytd %", "1y %", "5y annualized %", "interest 1-5", "understanding 1-5", "risk comfort 1-5", "research status", "first experiment", "notes", "last reviewed"], formulas: {},
  },
  investmentExperiments: {
    sheetName: "Investment Experiments", gid: 16, keys: ["experiment", "investment"],
    headers: ["investment sync id", "investment", "experiment", "mode", "status", "hypothesis", "benchmark", "start date", "review date", "starting amount", "recurring contribution", "start price / level", "current price / level", "current value", "return $", "return %", "fees", "learning", "decision", "data source", "last refreshed"], formulas: {},
  },
};

const blankSys = () => ({ _sync_id: "", _updated_at: "", _version: "", _deleted: false, _source: "" });
const row = values => ({ values: { ...values }, sys: blankSys() });

const tabs = {
  shortIdeas: [
    row({ id: 1, status: "Shortlist", tier: "A", category: "Sell what you own", opportunity: "Sell unused electronics", "personal fit / angle": "Fastest likely cash; photograph, reset securely, and list locally", "first cash": "1-7 days", "startup cost": 0, "weekly hrs": 3, "income model": "One-time", "low monthly": 100, "high monthly": 1500, "speed 1-5": 5, "fit 1-5": 4, "demand 1-5": 5, "scale 1-5": 1, "low cost 1-5": 5, "low risk 1-5": 5, "first test": "List 5 items with clear photos and fair prices" }),
    row({ id: 19, status: "Consider", tier: "B", category: "Reselling", opportunity: "Marketplace flipping", "personal fit / angle": "Start only with free/underpriced local items and strict margin rules", "first cash": "1-4 weeks", "startup cost": 100, "weekly hrs": 8, "income model": "Resale margin", "low monthly": 200, "high monthly": 1800, "speed 1-5": 3, "fit 1-5": 3, "demand 1-5": 4, "scale 1-5": 3, "low cost 1-5": 3, "low risk 1-5": 3, "first test": "Flip 3 items; no inventory purchase over $25" }),
    row({ id: 58, status: "Research", tier: "C", category: "Local service", opportunity: "Mobile notary signing agent", "personal fit / angle": "Detail-oriented; flexible hours", "first cash": "4-8 weeks", "startup cost": 150, "weekly hrs": 6, "income model": "Per signing", "low monthly": 200, "high monthly": 1500, "speed 1-5": 2, "fit 1-5": 4, "demand 1-5": 3, "scale 1-5": 2, "low cost 1-5": 4, "low risk 1-5": 4, "first test": "Check state commission requirements" }),
  ],
  experiments: [
    row({ idea: "Sell unused items", status: "Running", "start date": "2026-08-13", "decision date": "2026-08-20", hypothesis: "Five good listings will produce at least one sale", "test action": "List 5 items and improve once after 48 hours", budget: 0, hours: 0, leads: 0, replies: 0, sales: 0, revenue: 0, "direct cost": 0, "decision / learning": "" }),
  ],
  sprint: [],
  longIdeas: [
    row({ category: "Freelance", "income path": "Bookkeeping", "how it earns": "Monthly bookkeeping for small businesses", style: "Active", "startup low": 200, "startup high": 2500, "monthly cost": 150, "weeks to first $": 4, "hours / week": 20, "monthly income low": 2000, "monthly income high": 12000, "skill fit 1-5": 3, "interest 1-5": 3, "risk comfort 1-5": 4, "passive potential 1-5": 3, "setup effort 1-5": 3, "ongoing effort 1-5": 3, "sales effort 1-5": 4, "complexity 1-5": 3, status: "Explore", "first low-cost test": "Interview 5 business owners and offer a pilot", notes: "Training/certification can improve trust" }),
    row({ category: "Digital Product", "income path": "Online course", "how it earns": "Recorded lessons, cohort, or hybrid program", style: "Hybrid", "startup low": 200, "startup high": 5000, "monthly cost": 200, "weeks to first $": 10, "hours / week": 15, "monthly income low": 200, "monthly income high": 15000, "skill fit 1-5": 3, "interest 1-5": 3, "risk comfort 1-5": 2, "passive potential 1-5": 4, "setup effort 1-5": 4, "ongoing effort 1-5": 3, "sales effort 1-5": 5, "complexity 1-5": 3, status: "Explore", "first low-cost test": "Pre-sell a live beta before recording", notes: "Course creation alone does not create demand" }),
    row({ category: "Property", "income path": "Self-storage units", "how it earns": "Rent small storage units", style: "Passive", "startup low": 50000, "startup high": 400000, "monthly cost": 2000, "weeks to first $": 40, "hours / week": 5, "monthly income low": 1000, "monthly income high": 15000, "skill fit 1-5": 2, "interest 1-5": 4, "risk comfort 1-5": 2, "passive potential 1-5": 5, "setup effort 1-5": 5, "ongoing effort 1-5": 2, "sales effort 1-5": 2, "complexity 1-5": 4, status: "Research", "first low-cost test": "Price 5 local facilities", notes: "" }),
  ],
  plan: Array.from({ length: 12 }, (_, i) => row({ month: i + 1, stage: i < 2 ? "Discover" : i < 5 ? "Validate" : i < 8 ? "Build" : "Scale", status: "Not Started" })),
  costs: [
    row({ "income path": "Example: Consulting", "expense category": "Legal / Admin", "cost type": "One-time", "expense item": "Business registration", "low estimate": 100, "high estimate": 500, actual: "", "essential?": "Yes", "due / start date": "", "notes / vendor": "Check state/local requirements" }),
  ],
  investments: [],
  investmentExperiments: [],
};

const guardrails = {
  "monthly income needed": 5000, "cash available to start": 2000, "hours available per week": 30, "desired weeks to first income": 4,
  "risk tolerance (1-5)": 3, "preferred income style": "Hybrid", "preferred work setting": "Flexible", "skill fit weight": 5,
  "interest weight": 4, "risk comfort weight": 4, "passive potential weight": 2, "speed weight": 5, "income potential weight": 5, "low effort weight": 4,
};

let failMode = null;

const isData = (key, r) => DEF[key].keys.some(k => String(r.values[k] ?? "").trim() !== "") || Boolean(r.sys._sync_id);
const computed = (key, r) => {
  const out = { ...r.values };
  for (const [h, fn] of Object.entries(DEF[key].formulas)) out[h] = fn(r.values);
  for (const h of DEF[key].headers) if (!(h in out)) out[h] = "";
  return out;
};
const stamp = (r, source) => {
  r.sys._updated_at = new Date().toISOString();
  r.sys._version = (Number(r.sys._version) || 0) + 1;
  if (source) r.sys._source = source;
};

function pull() {
  const out = [];
  for (const key of Object.keys(DEF)) {
    const list = tabs[key];
    for (const r of list) {
      if (isData(key, r) && !r.sys._sync_id) {
        r.sys._sync_id = randomUUID();
        r.sys._version = 1;
        r.sys._updated_at = new Date().toISOString();
        r.sys._source = "sheet";
      }
    }
    out.push({
      key, found: true, sheetName: DEF[key].sheetName, gid: DEF[key].gid, headerRow: HEADER_ROW,
      headers: [...DEF[key].headers, ...SYSTEM], formulaHeaders: Object.keys(DEF[key].formulas),
      rows: list.map((r, i) => ({ r, i })).filter(({ r }) => isData(key, r)).map(({ r, i }) => ({
        row: HEADER_ROW + 1 + i, syncId: r.sys._sync_id, deleted: r.sys._deleted === true, version: Number(r.sys._version) || 0,
        updatedAt: r.sys._updated_at, source: r.sys._source, values: computed(key, r),
      })),
    });
  }
  return { ok: true, pulledAt: new Date().toISOString(), tabs: out, guardrails: { found: true, sheetName: "Start Here", gid: 1, values: { ...guardrails } } };
}

function write(ops, g) {
  const results = ops.map(op => {
    const ref = { tab: op.tab, syncId: op.syncId, op: op.op };
    const def = DEF[op.tab];
    if (!def) return { ...ref, ok: false, error: "tab_not_found" };
    const list = tabs[op.tab];
    let index = list.findIndex(r => r.sys._sync_id === op.syncId);
    if (op.op === "markDeleted" || op.op === "restore") {
      if (index < 0) return { ...ref, ok: true, missing: true };
      list[index].sys._deleted = op.op === "markDeleted";
      stamp(list[index], op.reason || "site");
      return { ...ref, ok: true, row: HEADER_ROW + 1 + index };
    }
    if (op.op === "reassign") {
      const r = list[op.row - HEADER_ROW - 1];
      if (!r || r.sys._sync_id !== op.syncId) return { ...ref, ok: false, error: "row_changed" };
      r.sys._sync_id = op.newSyncId;
      r.sys._source = "sheet-copy";
      return { ...ref, ok: true, row: op.row, newSyncId: op.newSyncId };
    }
    const values = { ...(op.values || {}) };
    let created = false;
    if (index < 0) {
      created = true;
      if (def.slots) index = list.findIndex(r => !isData(op.tab, r));
      if (index < 0) {
        const prev = list[list.length - 1];
        list.push(row({}));
        index = list.length - 1;
        if (def.slots && prev && !values.month) values.month = (Number(prev.values.month) || 0) + 1;
      }
      if (def.autoIncrement && (values[def.autoIncrement] === undefined || values[def.autoIncrement] === "" || values[def.autoIncrement] === null)) {
        values[def.autoIncrement] = Math.max(0, ...list.map(r => Number(r.values[def.autoIncrement]) || 0)) + 1;
      }
      Object.assign(list[index].sys, { _sync_id: op.syncId, _version: 0, _deleted: false, _source: "site" });
    }
    const r = list[index];
    if (op.restore && r.sys._deleted) r.sys._deleted = false;
    const conflicts = [];
    for (const [h, v] of Object.entries(values)) {
      if (!def.headers.includes(h) || h in def.formulas) continue;
      const now = r.values[h] ?? "";
      if (!created && op.expect && h in op.expect && normCell(now) !== op.expect[h]) {
        if (normCell(now) !== normCell(v)) conflicts.push({ header: h, sheetValue: now });
        continue;
      }
      r.values[h] = v === null || v === undefined ? "" : v;
    }
    stamp(r, "site");
    return { ...ref, ok: true, row: HEADER_ROW + 1 + index, created, conflicts, assigned: created && def.autoIncrement ? { [def.autoIncrement]: values[def.autoIncrement] } : {} };
  });
  let gOut = null;
  if (g) {
    const conflicts = [];
    for (const [k, v] of Object.entries(g.values || {})) {
      if (k in (g.expect || {}) && normCell(guardrails[k]) !== g.expect[k]) {
        if (normCell(guardrails[k]) !== normCell(v)) conflicts.push({ header: k, sheetValue: guardrails[k] });
        continue;
      }
      guardrails[k] = v;
    }
    gOut = { ok: true, conflicts };
  }
  return { ok: true, results, guardrails: gOut };
}

function control(path, body) {
  const list = tabs[body.tab];
  const find = () => list.findIndex(r => r.sys._sync_id === body.syncId);
  switch (path) {
    case "/__dump":
      return { tabs: Object.fromEntries(Object.keys(DEF).map(k => [k, { rows: tabs[k].map(r => ({ values: computed(k, r), sys: r.sys, isData: isData(k, r) })) }])), guardrails };
    case "/__edit": {
      const i = find();
      if (i < 0) return { ok: false, error: "not found" };
      Object.assign(list[i].values, body.set || {});
      Object.assign(list[i].sys, body.sys || {});
      stamp(list[i]);
      return { ok: true };
    }
    case "/__add": {
      const r = row(body.values || {});
      list.push(r);
      return { ok: true };
    }
    case "/__remove": {
      const i = find();
      if (i >= 0) list.splice(i, 1);
      return { ok: i >= 0 };
    }
    case "/__duplicate": {
      const i = find();
      if (i < 0) return { ok: false };
      list.push({ values: { ...list[i].values }, sys: { ...list[i].sys } });
      return { ok: true };
    }
    case "/__guardrail":
      guardrails[body.key] = body.value;
      return { ok: true };
    case "/__fail":
      failMode = body.mode || null;
      return { ok: true, failMode };
    default:
      return null;
  }
}

http.createServer((req, res) => {
  let data = "";
  req.on("data", c => { data += c; });
  req.on("end", () => {
    const body = data ? JSON.parse(data) : {};
    const send = (status, payload, type = "application/json") => {
      res.writeHead(status, { "content-type": type });
      res.end(type === "application/json" ? JSON.stringify(payload) : payload);
    };
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/__")) {
      const out = control(url.pathname, body);
      return out ? send(200, out) : send(404, { error: "unknown control" });
    }
    if (failMode === "auth") return send(403, "<html><body>Authorization is required to perform that action.</body></html>", "text/html");
    if (body.secret !== SECRET) return send(200, { ok: false, error: "unauthorized" });
    if (body.action === "pull") return send(200, pull());
    if (body.action === "write") return send(200, write(body.ops || [], body.guardrails));
    if (body.action === "setup") return send(200, { ok: true, log: ["mock setup ok"] });
    return send(200, { ok: false, error: `Unknown action: ${body.action}` });
  });
}).listen(PORT, () => console.log(`mock sheets listening on :${PORT}`));
