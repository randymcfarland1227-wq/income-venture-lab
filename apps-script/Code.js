/**
 * Income & Venture Lab — Google Sheets sync service.
 *
 * A web app that executes as the workbook owner. The Lab's server calls it with a shared
 * secret to pull rows and write changes, so no Google credentials ever reach the browser.
 *
 * Identity lives in a hidden `_sync_id` column — never in row numbers or names. An
 * installable onEdit trigger stamps `_updated_at` / `_version` (and assigns `_sync_id` to
 * brand-new rows) the moment something is edited in Sheets. The Lab reconciles on a timer.
 *
 * First-time setup: open this project in the Apps Script editor, pick `setup`, press Run,
 * and approve access. That adds the system columns, installs the triggers, and repairs
 * the broken Score /100 formula in Income Ideas.
 */

const SYNC_SECRET = '%%SYNC_SECRET%%';

const WORKBOOKS = {
  short: '1rEDmWfsFzu4_KiXdzpZEBvupqZwdakL5R86ZEQYlCOo',
  long: '1Z3Awg4j-QJYxOj88KOnBZhsFbGxTtw3Bi6TgybBHGYA',
};

const SYSTEM_COLUMNS = ['_sync_id', '_updated_at', '_version', '_deleted', '_source'];
const HIDDEN_SYSTEM_COLUMNS = ['_sync_id', '_updated_at', '_version', '_source'];

// Tabs are located by a header signature, so renaming a tab or adding title rows is safe.
// `keys` decide whether a row holds data. `slots` tabs (12-Month Plan) have pre-filled
// month rows that get filled in before any new row is inserted.
const TABS = {
  shortIdeas: {
    workbook: 'short', names: ['Income Ideas'],
    signature: ['id', 'opportunity', 'score /100'], keys: ['opportunity'], autoIncrement: 'id',
  },
  experiments: {
    workbook: 'short', names: ['Short Term Income Tracker', 'Experiment Tracker'],
    signature: ['idea', 'hypothesis', 'test action'], keys: ['idea', 'hypothesis', 'test action'],
  },
  sprint: {
    workbook: 'short', names: ['Actualizing Template'],
    signature: ['day', 'action', 'deliverable'], keys: ['action', 'deliverable'],
  },
  longIdeas: {
    workbook: 'long', names: ['Income Options'],
    signature: ['income path', 'how it earns', 'fit score /100'], keys: ['income path'],
  },
  plan: {
    workbook: 'long', names: ['12-Month Plan'],
    signature: ['month', 'income path', 'milestone / hypothesis'], keys: ['income path', 'milestone / hypothesis'],
    endAtBlank: true, slots: true, sequence: 'month',
  },
  costs: {
    workbook: 'long', names: ['Cost Planner'],
    signature: ['income path', 'expense item', 'low estimate'], keys: ['income path', 'expense item'],
  },
};

const GUARDRAIL_ANCHOR = 'monthly income needed';
const GUARDRAIL_LABELS = [
  'monthly income needed', 'cash available to start', 'hours available per week',
  'desired weeks to first income', 'risk tolerance (1-5)', 'preferred income style',
  'preferred work setting', 'location / service area', 'benefits / severance runway ends',
  'strongest skills', 'useful assets', 'constraints', 'non-negotiables',
  'skill fit weight', 'interest weight', 'risk comfort weight', 'passive potential weight',
  'speed weight', 'income potential weight', 'low effort weight',
];

// ---------------------------------------------------------------------------
// HTTP entry points
// ---------------------------------------------------------------------------

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.secret === SYNC_SECRET && params.action) return json_(dispatch_({ action: params.action }));
  return json_({ ok: true, service: 'income-venture-lab-sync', version: 1 });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON body' });
  }
  if (body.secret !== SYNC_SECRET) return json_({ ok: false, error: 'unauthorized' });
  return json_(dispatch_(body));
}

function dispatch_(body) {
  try {
    switch (body.action) {
      case 'status':
        return { ok: true, tabs: Object.keys(TABS).map(key => describe_(key, locateTab_(key))) };
      case 'pull':
        return {
          ok: true,
          pulledAt: new Date().toISOString(),
          tabs: (body.tabs || Object.keys(TABS)).map(pullTab_),
          guardrails: pullGuardrails_(),
        };
      case 'write':
        return {
          ok: true,
          results: writeOps_(body.ops || []),
          guardrails: body.guardrails ? writeGuardrails_(body.guardrails) : null,
        };
      case 'setup':
        return { ok: true, log: setup() };
      default:
        return { ok: false, error: 'Unknown action: ' + body.action };
    }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// One-time setup (run from the editor)
// ---------------------------------------------------------------------------

function setup() {
  const log = [];
  withLock_(() => {
    Object.keys(TABS).forEach(key => {
      const tab = locateTab_(key);
      if (!tab) {
        log.push(key + ': tab not found — skipped');
        return;
      }
      ensureSystemColumns_(tab);
      styleSystemColumns_(tab);
      const rows = readRows_(tab);
      const assigned = assignMissingIds_(tab, rows);
      applyCheckboxes_(tab, rows.filter(r => r.isData || tab.cfg.slots).map(r => r.row));
      if (key === 'shortIdeas') log.push(repairShortScore_(tab, rows));
      rememberTab_(tab);
      log.push(key + ': "' + tab.sheet.getName() + '" header row ' + tab.headerRow + ', ' +
        rows.filter(r => r.isData).length + ' rows, ' + assigned + ' new sync ids');
    });
  });
  installTriggers_();
  log.push('onEdit triggers installed for both workbooks');
  console.log(log.join('\n'));
  return log;
}

function installTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onSheetEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Object.keys(WORKBOOKS).forEach(k => {
    ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(WORKBOOKS[k]).onEdit().create();
  });
}

// The six 1–5 inputs are intact but Score /100 shows #REF!. Replace it with the plain
// average the sheet describes: (speed + fit + demand + scale + low cost + low risk) / 30 × 100.
function repairShortScore_(tab, rows) {
  const scoreCol = tab.col['score /100'];
  const inputs = ['speed 1-5', 'fit 1-5', 'demand 1-5', 'scale 1-5', 'low cost 1-5', 'low risk 1-5'].map(h => tab.col[h]);
  if (!scoreCol || inputs.some(c => !c)) return 'Score /100: columns not found — left unchanged';
  const dataRows = rows.filter(r => r.isData);
  const broken = dataRows.filter(r => {
    const v = r.values[scoreCol - 1];
    return v === '' || (typeof v === 'string' && v.charAt(0) === '#');
  });
  if (!broken.length) return 'Score /100: already valid — left unchanged';
  dataRows.forEach(r => {
    const refs = inputs.map(c => columnLetter_(c) + r.row).join('+');
    tab.sheet.getRange(r.row, scoreCol).setFormula('=IFERROR(ROUND((' + refs + ')/30*100),"")');
  });
  tab.sheet.getRange(tab.headerRow, scoreCol).setNote(
    'Repaired by Income & Venture Lab on ' + new Date().toDateString() +
    ': the previous formula returned #REF!. Now (sum of the six 1–5 inputs) ÷ 30 × 100.');
  return 'Score /100: repaired ' + dataRows.length + ' formulas (' + broken.length + ' were broken)';
}

// ---------------------------------------------------------------------------
// Edit trigger — stamps versions and assigns identity to new rows
// ---------------------------------------------------------------------------

function onSheetEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const index = JSON.parse(PropertiesService.getScriptProperties().getProperty('tabIndex') || '{}');
    const entry = index[e.source.getId() + ':' + sheet.getSheetId()];
    if (!entry) return;

    const first = Math.max(range.getRow(), entry.headerRow + 1);
    const last = range.getLastRow();
    if (last < first) return;

    // Edits that only touch the hidden bookkeeping columns are not user changes.
    const c1 = range.getColumn();
    const c2 = range.getLastColumn();
    const touchesUserCells = [];
    for (let c = c1; c <= c2; c++) {
      if (c === entry.sys._deleted || Object.keys(entry.sys).every(k => entry.sys[k] !== c)) touchesUserCells.push(c);
    }
    if (!touchesUserCells.length) return;

    withLock_(() => {
      const block = sheet.getRange(first, 1, last - first + 1, entry.width).getValues();
      const now = new Date().toISOString();
      block.forEach((row, i) => {
        const hasKey = entry.keyCols.some(c => String(row[c - 1]).trim() !== '');
        const syncId = String(row[entry.sys._sync_id - 1] || '').trim();
        if (!hasKey && !syncId) return;
        const changes = {};
        if (!syncId) {
          changes[entry.sys._sync_id] = Utilities.getUuid();
          changes[entry.sys._source] = 'sheet';
        }
        changes[entry.sys._updated_at] = now;
        changes[entry.sys._version] = (Number(row[entry.sys._version - 1]) || 0) + 1;
        writeCells_(sheet, first + i, changes);
      });
    });
  } catch (err) {
    console.error('onSheetEdit failed: ' + err);
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

function pullTab_(key) {
  if (!TABS[key]) return { key: key, found: false, error: 'unknown tab' };
  return withLock_(() => {
    const tab = locateTab_(key);
    if (!tab) return { key: key, found: false };
    if (ensureSystemColumns_(tab)) styleSystemColumns_(tab);
    const rows = readRows_(tab);
    const assigned = assignMissingIds_(tab, rows);
    if (assigned) applyCheckboxes_(tab, rows.filter(r => r.isData).map(r => r.row));
    rememberTab_(tab);

    const formulaHeaders = tab.headers.filter((h, i) => h && rows.some(r => r.isData && r.formulas[i]));
    return {
      key: key,
      found: true,
      sheetName: tab.sheet.getName(),
      gid: tab.sheet.getSheetId(),
      headerRow: tab.headerRow,
      headers: tab.headers,
      formulaHeaders: formulaHeaders,
      rows: rows.filter(r => r.isData).map(r => ({
        row: r.row,
        syncId: String(cell_(tab, r.values, '_sync_id') || '').trim(),
        deleted: isTrue_(cell_(tab, r.values, '_deleted')),
        version: Number(cell_(tab, r.values, '_version')) || 0,
        updatedAt: serializeSystem_(cell_(tab, r.values, '_updated_at')),
        source: String(cell_(tab, r.values, '_source') || ''),
        values: rowObject_(tab, r.values),
      })),
    };
  });
}

function assignMissingIds_(tab, rows) {
  const now = new Date().toISOString();
  let count = 0;
  rows.forEach(r => {
    if (!r.isData) return;
    const idCol = tab.col._sync_id;
    if (String(r.values[idCol - 1] || '').trim()) return;
    const id = Utilities.getUuid();
    const changes = {};
    changes[idCol] = id;
    changes[tab.col._updated_at] = now;
    changes[tab.col._version] = 1;
    changes[tab.col._source] = 'sheet';
    writeCells_(tab.sheet, r.row, changes);
    Object.keys(changes).forEach(c => { r.values[Number(c) - 1] = changes[c]; });
    count++;
  });
  return count;
}

function pullGuardrails_() {
  const g = locateGuardrails_();
  if (!g) return { found: false };
  const tz = g.ss.getSpreadsheetTimeZone();
  const values = {};
  Object.keys(g.cells).forEach(label => {
    const c = g.cells[label];
    values[label] = serialize_(g.grid[c.row - 1][c.col - 1], tz);
  });
  return { found: true, sheetName: g.sheet.getName(), gid: g.sheet.getSheetId(), values: values };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function writeOps_(ops) {
  return withLock_(() => {
    const tabs = {};
    return ops.map(op => {
      const ref = { tab: op.tab, syncId: op.syncId, op: op.op };
      try {
        if (!(op.tab in tabs)) {
          const located = TABS[op.tab] ? locateTab_(op.tab) : null;
          if (located && ensureSystemColumns_(located)) styleSystemColumns_(located);
          tabs[op.tab] = located;
        }
        const tab = tabs[op.tab];
        if (!tab) return Object.assign(ref, { ok: false, error: 'tab_not_found' });
        if (!op.syncId) return Object.assign(ref, { ok: false, error: 'missing_sync_id' });

        let rowNum = findRow_(tab, op.syncId);
        if (op.op === 'markDeleted' || op.op === 'restore') {
          if (!rowNum) return Object.assign(ref, { ok: true, missing: true });
          const changes = {};
          changes[tab.col._deleted] = op.op === 'markDeleted';
          changes[tab.col._source] = op.reason || 'site';
          changes[tab.col._updated_at] = new Date().toISOString();
          changes[tab.col._version] = (Number(tab.sheet.getRange(rowNum, tab.col._version).getValue()) || 0) + 1;
          writeCells_(tab.sheet, rowNum, changes);
          return Object.assign(ref, { ok: true, row: rowNum });
        }
        // A copy-pasted row carries its source's `_sync_id`; give the copy its own identity.
        if (op.op === 'reassign') {
          const r = Number(op.row);
          const current = String(tab.sheet.getRange(r, tab.col._sync_id).getValue() || '').trim();
          if (current !== op.syncId || !op.newSyncId) return Object.assign(ref, { ok: false, error: 'row_changed' });
          const changes = {};
          changes[tab.col._sync_id] = op.newSyncId;
          changes[tab.col._source] = 'sheet-copy';
          changes[tab.col._updated_at] = new Date().toISOString();
          writeCells_(tab.sheet, r, changes);
          tab.rowIndex = null;
          return Object.assign(ref, { ok: true, row: r, newSyncId: op.newSyncId });
        }
        if (op.op !== 'upsert') return Object.assign(ref, { ok: false, error: 'unknown_op' });

        const values = Object.assign({}, op.values || {});
        let created = false;
        if (!rowNum) {
          rowNum = appendRow_(tab, op.syncId, values);
          created = true;
        }
        const conflicts = updateRow_(tab, rowNum, values, created ? null : op.expect, created, !!op.restore);
        const assigned = {};
        if (created && tab.cfg.autoIncrement) assigned[tab.cfg.autoIncrement] = values[tab.cfg.autoIncrement];
        return Object.assign(ref, { ok: true, row: rowNum, created: created, conflicts: conflicts, assigned: assigned });
      } catch (err) {
        return Object.assign(ref, { ok: false, error: String((err && err.message) || err) });
      }
    });
  });
}

function appendRow_(tab, syncId, values) {
  const sheet = tab.sheet;
  const rows = readRows_(tab);
  const dataRows = rows.filter(r => r.isData);
  let target = null;

  if (tab.cfg.slots) {
    const slot = rows.find(r => !r.isData);
    if (slot) target = slot.row;
  }
  if (!target) {
    const regionEnd = rows.length ? rows[rows.length - 1].row : tab.headerRow;
    const lastData = dataRows.length ? dataRows[dataRows.length - 1].row : tab.headerRow;
    const next = lastData + 1;
    const nextRow = rows.find(r => r.row === next);
    const nextIsFree = !tab.cfg.endAtBlank && next <= sheet.getMaxRows() && (!nextRow || isBlank_(nextRow.values));
    if (nextIsFree) {
      target = next;
    } else {
      const after = tab.cfg.endAtBlank ? regionEnd : lastData;
      sheet.insertRowAfter(after);
      target = after + 1;
    }
  }

  // Carry calculated columns down from the data row above.
  const above = target - 1;
  if (above > tab.headerRow && dataRows.some(r => r.row === above)) {
    const r1c1 = sheet.getRange(above, 1, 1, tab.width).getFormulasR1C1()[0];
    const existing = sheet.getRange(target, 1, 1, tab.width).getFormulas()[0];
    r1c1.forEach((f, i) => {
      if (f && !existing[i] && SYSTEM_COLUMNS.indexOf(tab.headers[i]) === -1) {
        sheet.getRange(target, i + 1).setFormulaR1C1(f);
      }
    });
    const seq = tab.cfg.sequence;
    if (seq && tab.col[seq] && (values[seq] === undefined || values[seq] === '' || values[seq] === null)) {
      const prev = Number(sheet.getRange(above, tab.col[seq]).getValue());
      if (isFinite(prev) && prev > 0 && !sheet.getRange(target, tab.col[seq]).getValue()) values[seq] = prev + 1;
    }
  }

  const auto = tab.cfg.autoIncrement;
  if (auto && tab.col[auto] && (values[auto] === undefined || values[auto] === '' || values[auto] === null)) {
    const max = dataRows.reduce((m, r) => Math.max(m, Number(r.values[tab.col[auto] - 1]) || 0), 0);
    values[auto] = max + 1;
  }

  const changes = {};
  changes[tab.col._sync_id] = syncId;
  changes[tab.col._updated_at] = new Date().toISOString();
  changes[tab.col._version] = 0;
  changes[tab.col._deleted] = false;
  changes[tab.col._source] = 'site';
  writeCells_(sheet, target, changes);
  applyCheckboxes_(tab, [target]);
  tab.rowIndex = null;
  return target;
}

// Writes only the cells that change, one contiguous run at a time. Formula cells are never
// overwritten, and when `expect` is given a cell that moved since the last sync is reported
// as a conflict instead of being clobbered.
function updateRow_(tab, rowNum, values, expect, created, restore) {
  const range = tab.sheet.getRange(rowNum, 1, 1, tab.width);
  const current = range.getValues()[0];
  const formulas = range.getFormulas()[0];
  const conflicts = [];
  const changes = {};
  if (restore && isTrue_(current[tab.col._deleted - 1])) changes[tab.col._deleted] = false;

  Object.keys(values).forEach(h => {
    const c = tab.col[h];
    if (!c || SYSTEM_COLUMNS.indexOf(h) !== -1) return;
    if (formulas[c - 1]) return;
    const now = current[c - 1];
    if (expect && Object.prototype.hasOwnProperty.call(expect, h) && normCell_(now, tab.tz) !== String(expect[h])) {
      if (normCell_(now, tab.tz) !== normCell_(values[h], tab.tz)) {
        conflicts.push({ header: h, sheetValue: serialize_(now, tab.tz) });
      }
      return;
    }
    const next = toCell_(values[h]);
    if (normCell_(now, tab.tz) === normCell_(next, tab.tz)) return;
    changes[c] = next;
  });

  if (Object.keys(changes).length || created) {
    changes[tab.col._updated_at] = new Date().toISOString();
    changes[tab.col._version] = (Number(current[tab.col._version - 1]) || 0) + 1;
    changes[tab.col._source] = 'site';
    writeCells_(tab.sheet, rowNum, changes);
  }
  return conflicts;
}

function writeGuardrails_(payload) {
  const g = locateGuardrails_();
  if (!g) return { ok: false, error: 'guardrails_not_found' };
  const tz = g.ss.getSpreadsheetTimeZone();
  const conflicts = [];
  const values = payload.values || {};
  const expect = payload.expect || {};
  Object.keys(values).forEach(label => {
    const c = g.cells[label];
    if (!c) return;
    const now = g.grid[c.row - 1][c.col - 1];
    if (Object.prototype.hasOwnProperty.call(expect, label) && normCell_(now, tz) !== String(expect[label])) {
      if (normCell_(now, tz) !== normCell_(values[label], tz)) conflicts.push({ header: label, sheetValue: serialize_(now, tz) });
      return;
    }
    if (normCell_(now, tz) !== normCell_(values[label], tz)) g.sheet.getRange(c.row, c.col).setValue(toCell_(values[label]));
  });
  return { ok: true, conflicts: conflicts };
}

// ---------------------------------------------------------------------------
// Tab discovery & structure
// ---------------------------------------------------------------------------

function locateTab_(key) {
  const cfg = TABS[key];
  const ss = SpreadsheetApp.openById(WORKBOOKS[cfg.workbook]);
  const named = cfg.names.map(n => ss.getSheetByName(n)).filter(Boolean);
  const candidates = named.concat(ss.getSheets().filter(s => named.indexOf(s) === -1));
  for (let s = 0; s < candidates.length; s++) {
    const sheet = candidates[s];
    const scan = Math.min(25, sheet.getLastRow());
    const lastCol = sheet.getLastColumn();
    if (!scan || !lastCol) continue;
    const grid = sheet.getRange(1, 1, scan, lastCol).getDisplayValues();
    for (let r = 0; r < grid.length; r++) {
      const normalized = grid[r].map(normHeader_);
      if (cfg.signature.every(sig => normalized.indexOf(sig) !== -1)) {
        return buildTab_(key, cfg, ss, sheet, r + 1);
      }
    }
  }
  return null;
}

function buildTab_(key, cfg, ss, sheet, headerRow) {
  const tab = { key: key, cfg: cfg, ss: ss, sheet: sheet, headerRow: headerRow, tz: ss.getSpreadsheetTimeZone() };
  refreshTab_(tab);
  return tab;
}

function refreshTab_(tab) {
  const lastCol = tab.sheet.getLastColumn();
  const raw = tab.sheet.getRange(tab.headerRow, 1, 1, lastCol).getDisplayValues()[0];
  let width = 0;
  raw.forEach((h, i) => { if (String(h).trim()) width = i + 1; });
  tab.headers = raw.slice(0, width).map(normHeader_);
  tab.col = {};
  tab.headers.forEach((h, i) => { if (h && !(h in tab.col)) tab.col[h] = i + 1; });
  tab.width = width;
  tab.rowIndex = null;
}

function ensureSystemColumns_(tab) {
  const missing = SYSTEM_COLUMNS.filter(c => !tab.col[c]);
  if (!missing.length) return false;
  const start = tab.width + 1;
  const needed = start + missing.length - 1;
  const max = tab.sheet.getMaxColumns();
  if (max < needed) tab.sheet.insertColumnsAfter(max, needed - max);
  tab.sheet.getRange(tab.headerRow, start, 1, missing.length).setValues([missing]);
  refreshTab_(tab);
  return true;
}

function styleSystemColumns_(tab) {
  const sheet = tab.sheet;
  SYSTEM_COLUMNS.forEach(name => {
    const c = tab.col[name];
    if (!c) return;
    sheet.getRange(tab.headerRow, c).setFontColor('#8a9894').setFontStyle('italic').setFontSize(9);
    if (HIDDEN_SYSTEM_COLUMNS.indexOf(name) !== -1) sheet.hideColumns(c);
  });
  const del = tab.col._deleted;
  if (!del) return;
  sheet.getRange(tab.headerRow, del).setNote(
    'Check this box to archive the row. Income & Venture Lab soft-deletes the matching idea ' +
    'and keeps a tombstone, so nothing is destroyed and nothing resurrects by accident.');

  const formula = '=$' + columnLetter_(del) + (tab.headerRow + 1) + '=TRUE';
  const rules = sheet.getConditionalFormatRules();
  const exists = rules.some(rule => {
    const cond = rule.getBooleanCondition();
    return cond && cond.getCriteriaValues().join('') === formula;
  });
  if (!exists) {
    const span = Math.max(1, sheet.getMaxRows() - tab.headerRow);
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setStrikethrough(true)
      .setFontColor('#9aa5a1')
      .setRanges([sheet.getRange(tab.headerRow + 1, 1, span, tab.width)])
      .build();
    rules.push(rule);
    sheet.setConditionalFormatRules(rules);
  }
}

function applyCheckboxes_(tab, rowNumbers) {
  const c = tab.col._deleted;
  if (!c || !rowNumbers.length) return;
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  rowNumbers.forEach(r => tab.sheet.getRange(r, c).setDataValidation(rule));
}

function readRows_(tab) {
  const sheet = tab.sheet;
  const first = tab.headerRow + 1;
  const last = sheet.getLastRow();
  if (last < first) return [];
  const range = sheet.getRange(first, 1, last - first + 1, tab.width);
  const values = range.getValues();
  const formulas = range.getFormulas();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const vals = values[i];
    if (tab.cfg.endAtBlank && isBlank_(vals)) break;
    const syncId = String(cell_(tab, vals, '_sync_id') || '').trim();
    const hasKey = tab.cfg.keys.some(k => tab.col[k] && String(vals[tab.col[k] - 1]).trim() !== '');
    out.push({ row: first + i, values: vals, formulas: formulas[i], isData: hasKey || !!syncId });
  }
  return out;
}

function findRow_(tab, syncId) {
  if (!tab.rowIndex) {
    tab.rowIndex = {};
    const first = tab.headerRow + 1;
    const last = tab.sheet.getLastRow();
    if (last >= first && tab.col._sync_id) {
      tab.sheet.getRange(first, tab.col._sync_id, last - first + 1, 1).getValues().forEach((v, i) => {
        const id = String(v[0] || '').trim();
        if (id && !tab.rowIndex[id]) tab.rowIndex[id] = first + i;
      });
    }
  }
  return tab.rowIndex[syncId] || null;
}

function rememberTab_(tab) {
  const props = PropertiesService.getScriptProperties();
  const index = JSON.parse(props.getProperty('tabIndex') || '{}');
  const sys = {};
  SYSTEM_COLUMNS.forEach(n => { sys[n] = tab.col[n]; });
  index[tab.ss.getId() + ':' + tab.sheet.getSheetId()] = {
    tab: tab.key,
    headerRow: tab.headerRow,
    width: tab.width,
    keyCols: tab.cfg.keys.map(k => tab.col[k]).filter(Boolean),
    sys: sys,
  };
  props.setProperty('tabIndex', JSON.stringify(index));
}

function describe_(key, tab) {
  if (!tab) return { key: key, found: false };
  return { key: key, found: true, sheetName: tab.sheet.getName(), gid: tab.sheet.getSheetId(), headerRow: tab.headerRow };
}

function locateGuardrails_() {
  const ss = SpreadsheetApp.openById(WORKBOOKS.long);
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const rows = Math.min(sheet.getLastRow(), 60);
    const cols = Math.min(sheet.getLastColumn(), 14);
    if (!rows || !cols) continue;
    const display = sheet.getRange(1, 1, rows, cols).getDisplayValues();
    const cells = {};
    display.forEach((r, i) => r.forEach((v, j) => {
      const n = normHeader_(v);
      if (GUARDRAIL_LABELS.indexOf(n) !== -1 && !cells[n] && j + 2 <= cols) cells[n] = { row: i + 1, col: j + 2 };
    }));
    if (cells[GUARDRAIL_ANCHOR]) {
      return { ss: ss, sheet: sheet, cells: cells, grid: sheet.getRange(1, 1, rows, cols).getValues() };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// Contiguous runs of changed columns are written with one call each.
function writeCells_(sheet, row, changes) {
  const cols = Object.keys(changes).map(Number).sort((a, b) => a - b);
  let i = 0;
  while (i < cols.length) {
    let j = i;
    while (j + 1 < cols.length && cols[j + 1] === cols[j] + 1) j++;
    const run = cols.slice(i, j + 1).map(c => changes[c]);
    sheet.getRange(row, cols[i], 1, run.length).setValues([run]);
    i = j + 1;
  }
}

function normHeader_(h) {
  return String(h === null || h === undefined ? '' : h)
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cell_(tab, values, header) {
  const c = tab.col[header];
  return c ? values[c - 1] : '';
}

function rowObject_(tab, values) {
  const obj = {};
  tab.headers.forEach((h, i) => {
    if (h && SYSTEM_COLUMNS.indexOf(h) === -1) obj[h] = serialize_(values[i], tab.tz);
  });
  return obj;
}

function isBlank_(values) {
  return values.every(v => v === '' || v === false || v === null);
}

function isTrue_(v) {
  return v === true || String(v).trim().toUpperCase() === 'TRUE';
}

function serialize_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : v;
}

function serializeSystem_(v) {
  if (v instanceof Date) return v.toISOString();
  return v === null || v === undefined ? '' : String(v);
}

// Must match normalize() in the Lab's lib/sync/values.ts exactly.
function normCell_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v).trim();
}

function toCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && v.charAt(0) === '=') return "'" + v;
  return v;
}

function columnLetter_(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
