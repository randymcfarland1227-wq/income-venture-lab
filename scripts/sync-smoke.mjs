/**
 * End-to-end check of the bidirectional sync against scripts/mock-sheets.mjs.
 * Point the dev server's GOOGLE_SHEETS_SYNC_URL at the mock (with a fresh local database),
 * then:  node scripts/sync-smoke.mjs
 */
const LAB = process.env.LAB_URL || "http://localhost:5173";
const MOCK = process.env.MOCK_URL || "http://localhost:8911";

async function call(url, body) {
  const response = await fetch(url, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`${url} → ${response.status} ${text.slice(0, 200)}`); }
}
// A browser tab (or a previous run) may hold the sync lock; wait for our own run to happen.
async function sync(action = "run", tabs) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const r = await call(`${LAB}/api/sync`, { action, tabs });
    if (!r.result?.skipped) return r;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("sync stayed locked for 20s");
}
const mutate = m => call(`${LAB}/api/mutate`, m);
const dump = () => call(`${MOCK}/__dump`);
const mock = (path, body) => call(`${MOCK}${path}`, body);

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail).slice(0, 400));
  }
}
const rowFor = (d, tab, syncId) => d.tabs[tab].rows.find(r => r.sys._sync_id === syncId);
const idea = (s, title) => s.ideas.find(i => i.title === title);

// 1 — First connected sync: link snapshot records, import new rows, retire the rest.
let r = await sync();
check("first sync succeeds", r.result?.ok, r.result ?? r);
let s = r.state;
const electronics = idea(s, "Sell unused electronics");
check("snapshot idea linked to its row by ID (adopts the row's _sync_id)", electronics && !electronics.syncId.startsWith("snapshot-") && !electronics.deletedAt, electronics);
check("title match links long-term snapshot idea", idea(s, "Bookkeeping") && !idea(s, "Bookkeeping").syncId.startsWith("snapshot-"));
check("new Sheet row imported as an idea", idea(s, "Mobile notary signing agent")?.source === "sheet");
check("Passive style mapped to Passive-ish", idea(s, "Self-storage units")?.incomeStyle === "Passive-ish");
check("snapshot records with no live row retired", s.ideas.filter(i => i.deletedAt).length > 50);
check("tracker experiment linked", s.experiments.some(e => e.ideaLabel === "Sell unused items" && !e.syncId.startsWith("snapshot-")));
check("calculated Score /100 pulled read-only", electronics?.sheetShortScore === 83, electronics?.sheetShortScore);
let d = await dump();
check("every data row carries a _sync_id", Object.values(d.tabs).every(t => t.rows.filter(x => x.isData).every(x => x.sys._sync_id)));
const liveCount = s.ideas.filter(i => !i.deletedAt).length;
r = await sync();
check("second sync is a no-op", r.result?.ok && r.result.fromSheet === 0 && r.result.toSheet === 0, r.result);
check("re-running creates no duplicates", r.state.ideas.filter(i => !i.deletedAt).length === liveCount);

// 1b — Investment rows are genuinely two-way for personal fields, while
// externally sourced/application-derived facts remain app-authoritative.
const benchmark = r.state.investments.find(i => i.id === "inv-sp500-benchmark");
await mock("/__edit", { tab: "investments", syncId: benchmark.syncId, set: { status: "Researching", notes: "Compare methodology", "current value": 999999 } });
r = await sync();
d = await dump();
const benchmarkAfterSheet = r.state.investments.find(i => i.id === benchmark.id);
check("investment status and notes flow Sheet → site", benchmarkAfterSheet.status === "Researching" && benchmarkAfterSheet.notes === "Compare methodology", benchmarkAfterSheet);
check("manual market-data edit is rejected and re-derived", rowFor(d, "investments", benchmark.syncId)?.values["current value"] === "", rowFor(d, "investments", benchmark.syncId)?.values["current value"]);
await mutate({ op: "update", collection: "investments", id: benchmark.id, data: { notes: "Source methodology reviewed" } });
r = await sync();
d = await dump();
check("investment notes flow site → Sheet", rowFor(d, "investments", benchmark.syncId)?.values.notes === "Source methodology reviewed");

// 2 — Site-created "Both" idea lands in both workbooks as one idea.
const created = await mutate({ op: "create", collection: "ideas", data: { title: "Wedding Venue", horizon: "Both", incomeStyle: "Hybrid", opportunityType: "Property", category: "Events", description: "Weekend events" } });
r = await sync();
d = await dump();
const venue = r.state.ideas.find(i => i.id === created.id);
check("Both idea added to Income Ideas", !!rowFor(d, "shortIdeas", venue.syncId));
check("Both idea added to Income Options", !!rowFor(d, "longIdeas", venue.syncId));
check("new short row gets the next ID", rowFor(d, "shortIdeas", venue.syncId)?.values.id === 59, rowFor(d, "shortIdeas", venue.syncId)?.values.id);
check("site idea learns its sheet ID", r.state.ideas.find(i => i.id === venue.id)?.sheetRef === 59);

// 3 — Sheet edit flows to the site and on to the other workbook.
await mock("/__edit", { tab: "longIdeas", syncId: venue.syncId, set: { "startup low": 25000, status: "Research" } });
r = await sync();
let v = r.state.ideas.find(i => i.id === venue.id);
check("sheet edit applied on the site", v.startupLow === 25000 && v.status === "Research", { startupLow: v.startupLow, status: v.status });
d = await dump();
check("same edit propagated to the other workbook", rowFor(d, "shortIdeas", venue.syncId)?.values.status === "Research" && rowFor(d, "shortIdeas", venue.syncId)?.values["startup cost"] === 25000);

// 4 — Site edit flows to both workbooks.
await mutate({ op: "update", collection: "ideas", id: venue.id, data: { monthlyHigh: 12000 } });
r = await sync();
d = await dump();
check("site edit written to both sheets", rowFor(d, "longIdeas", venue.syncId)?.values["monthly income high"] === 12000 && rowFor(d, "shortIdeas", venue.syncId)?.values["high monthly"] === 12000);

// 5 — Both sides change the same value: conflict, nothing overwritten.
await mutate({ op: "update", collection: "ideas", id: venue.id, data: { startupHigh: 30000 } });
await mock("/__edit", { tab: "longIdeas", syncId: venue.syncId, set: { "startup high": 35000 } });
r = await sync();
const conflict = r.state.conflicts.find(c => c.entityId === venue.id && c.field === "startupHigh");
check("conflict recorded", !!conflict, r.state.conflicts);
check("sync health reports the conflict", r.state.sync.health === "conflict", r.state.sync.health);
d = await dump();
check("sheet value untouched while in conflict", rowFor(d, "longIdeas", venue.syncId)?.values["startup high"] === 35000);
check("site value untouched while in conflict", r.state.ideas.find(i => i.id === venue.id)?.startupHigh === 30000);
await mutate({ op: "resolveConflict", id: conflict.id, choice: "site" });
r = await sync();
d = await dump();
check("Use Site pushes the site value", rowFor(d, "longIdeas", venue.syncId)?.values["startup high"] === 30000);
check("conflict closed", !r.state.conflicts.some(c => c.id === conflict.id) && r.state.sync.health === "synced", r.state.sync.health);

// 6 — Horizon moves keep one idea and move its representations.
await mutate({ op: "update", collection: "ideas", id: venue.id, data: { horizon: "Long Term" } });
r = await sync();
d = await dump();
check("Both → Long Term archives the short row", rowFor(d, "shortIdeas", venue.syncId)?.sys._deleted === true);
check("long row still live", rowFor(d, "longIdeas", venue.syncId)?.sys._deleted === false);
check("still exactly one site idea", r.state.ideas.filter(i => i.title === "Wedding Venue").length === 1);
await mutate({ op: "update", collection: "ideas", id: venue.id, data: { horizon: "Both" } });
r = await sync();
d = await dump();
check("Long Term → Both restores the short row", rowFor(d, "shortIdeas", venue.syncId)?.sys._deleted === false);

// 7 — A row typed into the Sheet becomes an idea; the archive checkbox soft-deletes it.
await mock("/__add", { tab: "shortIdeas", values: { opportunity: "Pet sitting weekends", status: "Consider", category: "Local service", "startup cost": 40 } });
r = await sync();
const pet = idea(r.state, "Pet sitting weekends");
check("new sheet row became an idea", pet && !pet.deletedAt);
await mock("/__edit", { tab: "shortIdeas", syncId: pet.syncId, sys: { _deleted: true } });
r = await sync();
check("_deleted checkbox soft-deletes the idea", !!r.state.ideas.find(i => i.id === pet.id)?.deletedAt);
r = await sync();
check("archived idea does not resurrect", !!r.state.ideas.find(i => i.id === pet.id)?.deletedAt);

// 8 — Archive on the site marks every row; restore brings them back.
await mutate({ op: "delete", collection: "ideas", id: venue.id });
r = await sync();
d = await dump();
check("site archive marks both sheet rows", rowFor(d, "shortIdeas", venue.syncId)?.sys._deleted === true && rowFor(d, "longIdeas", venue.syncId)?.sys._deleted === true);
await mutate({ op: "restore", collection: "ideas", id: venue.id });
r = await sync();
d = await dump();
check("site restore un-archives the rows", rowFor(d, "shortIdeas", venue.syncId)?.sys._deleted === false && rowFor(d, "longIdeas", venue.syncId)?.sys._deleted === false);

// 9 — Copy-pasted row: the copy gets its own identity.
await mock("/__duplicate", { tab: "longIdeas", syncId: idea(r.state, "Online course").syncId });
r = await sync();
d = await dump();
const courses = r.state.ideas.filter(i => i.title === "Online course" && !i.deletedAt);
check("copied row becomes a second idea", courses.length === 2, courses.length);
check("copied row got a new _sync_id", new Set(d.tabs.longIdeas.rows.filter(x => x.values["income path"] === "Online course").map(x => x.sys._sync_id)).size === 2);

// 10 — Guardrails sync both ways.
await mock("/__guardrail", { key: "monthly income needed", value: 6000 });
await mutate({ op: "setGuardrail", key: "hours available per week", value: 25 });
r = await sync();
d = await dump();
check("sheet guardrail edit reaches the site", r.state.guardrails["monthly income needed"] === 6000, r.state.guardrails["monthly income needed"]);
check("site guardrail edit reaches the sheet", d.guardrails["hours available per week"] === 25, d.guardrails["hours available per week"]);

// 11 — Child records: experiment → tracker, milestone → plan slot, expense → cost planner.
const bookkeeping = idea(r.state, "Bookkeeping");
await mutate({ op: "create", collection: "experiments", data: { ideaId: electronics.id, name: "Weekend listing test", hypothesis: "Three listings sell within a week", status: "Running", budget: 20 } });
const ms = await mutate({ op: "create", collection: "milestones", data: { ideaId: bookkeeping.id, title: "Interview 5 owners", stage: "Validate", month: 1, spendingCap: 50 } });
await mutate({ op: "create", collection: "expenses", data: { ideaId: bookkeeping.id, item: "Bookkeeping course", costType: "One-time", low: 50, high: 200, essential: "Yes" } });
r = await sync();
d = await dump();
check("experiment appended to the tracker", d.tabs.experiments.rows.some(x => x.values.idea === "Sell unused electronics" && x.values.hypothesis === "Three listings sell within a week"));
check("milestone filled an empty month slot", d.tabs.plan.rows.length === 12 && d.tabs.plan.rows.some(x => x.values["milestone / hypothesis"] === "Interview 5 owners" && x.values["income path"] === "Bookkeeping"));
check("expense appended to the cost planner", d.tabs.costs.rows.some(x => x.values["expense item"] === "Bookkeeping course"));
// Renaming an idea rewrites the free-text idea columns that point at it.
await mutate({ op: "update", collection: "ideas", id: bookkeeping.id, data: { title: "Small-business bookkeeping" } });
r = await sync();
d = await dump();
check("rename updates the plan's Income Path", d.tabs.plan.rows.some(x => x.values["income path"] === "Small-business bookkeeping"));
check("milestone stays linked after rename", r.state.milestones.find(m => m.id === ms.id)?.ideaId === bookkeeping.id);

// 12 — One physically deleted row is treated as a removal.
const notary = idea(r.state, "Mobile notary signing agent");
await mock("/__remove", { tab: "shortIdeas", syncId: notary.syncId });
r = await sync();
check("a single removed row archives its idea", !!r.state.ideas.find(i => i.id === notary.id)?.deletedAt);

// 13 — Many rows vanishing at once is held for confirmation.
d = await dump();
const survivors = d.tabs.shortIdeas.rows.filter(x => x.isData && !x.sys._deleted).map(x => x.sys._sync_id);
for (const id of survivors) await mock("/__remove", { tab: "shortIdeas", syncId: id });
r = await sync();
const stillLive = r.state.ideas.filter(i => survivors.includes(i.syncId) && !i.deletedAt).length;
check("mass disappearance deletes nothing", stillLive === survivors.length, { stillLive, survivors: survivors.length });
check("health reports the issue", r.state.sync.health === "issue", r.state.sync.health);
const activity = await call(`${LAB}/api/sync`);
check("missing rows await confirmation", (activity.pendingMissing?.shortIdeas ?? 0) > 0, activity.pendingMissing);
r = await sync("acceptMissing", ["shortIdeas"]);
check("confirming removes them", r.state.ideas.filter(i => survivors.includes(i.syncId) && !i.deletedAt).filter(i => i.horizon === "Short Term").length === 0);

// 14 — Losing Google authorization is reported, not treated as data loss.
await mock("/__fail", { mode: "auth" });
r = await sync();
check("auth failure → needs authorization", r.state.sync.health === "needs_authorization", r.state.sync);
check("no data touched on auth failure", r.state.ideas.filter(i => !i.deletedAt).length > 0);
await mock("/__fail", { mode: null });
r = await sync();
check("recovers once authorized again", r.result?.ok, r.result);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll sync checks passed");
process.exit(failures ? 1 : 0);
