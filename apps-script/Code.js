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
const GITHUB_ORIGIN = 'https://randymcfarland1227-wq.github.io';
const STATE_PREFIX = 'ivl_state_';
const STATE_CHUNK_SIZE = 8000;

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
    workbook: 'long', names: ['Long-Term Strategy', 'Income Options'],
    signature: ['strategy / path', '1-year foundation', '10-year vision'], keys: ['strategy / path'],
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
  investments: {
    workbook: 'long', names: ['Investing & Assets'],
    signature: ['investment / account', 'account or asset', 'current value'], keys: ['investment / account'],
    createHeaders: [
      'Status', 'Classification', 'Category', 'Investment / Account', 'Symbol / Series', 'Account or Asset',
      'Definition', 'How It Earns', 'Typical Horizon', 'Liquidity', 'Income Frequency', 'Market Risk',
      'Principal Risk', 'Credit Risk', 'Interest Rate Risk', 'Inflation Risk', 'Complexity', 'Passive Level',
      'Minimum / Access Notes', 'Fees / Expense Notes', 'Tax / Account Notes', 'Benchmark', 'Current Metric',
      'Current Value', 'Observation Date', 'Data Source', 'YTD %', '1Y %', '5Y Annualized %',
      'Interest 1–5', 'Understanding 1–5', 'Risk Comfort 1–5', 'Research Status', 'First Experiment',
      'Notes', 'Last Reviewed'
    ],
    appOwned: ['market risk', 'principal risk', 'credit risk', 'interest rate risk', 'inflation risk', 'complexity',
      'current metric', 'current value', 'observation date', 'data source', 'ytd %', '1y %', '5y annualized %'],
  },
  investmentExperiments: {
    workbook: 'long', names: ['Investment Experiments'],
    signature: ['investment', 'experiment', 'starting amount'], keys: ['investment', 'experiment'],
    createHeaders: [
      'Investment Sync ID', 'Investment', 'Experiment', 'Mode', 'Status', 'Hypothesis', 'Benchmark',
      'Start Date', 'Review Date', 'Starting Amount', 'Recurring Contribution', 'Start Price / Level',
      'Current Price / Level', 'Current Value', 'Return $', 'Return %', 'Fees', 'Learning', 'Decision',
      'Data Source', 'Last Refreshed'
    ],
    appOwned: ['investment sync id', 'current price / level', 'current value', 'return $', 'return %', 'data source', 'last refreshed'],
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
  if (params.mode === 'bridge' && params.origin === GITHUB_ORIGIN && params.session) {
    const origin = JSON.stringify(params.origin);
    const session = JSON.stringify(params.session);
    const html = '<!doctype html><meta charset="utf-8"><script>' +
      'const ORIGIN=' + origin + ',SESSION=' + session + ';' +
      'addEventListener("message",function(e){' +
      'if(e.origin!==ORIGIN||!e.data||e.data.type!=="ivl-call"||e.data.session!==SESSION)return;' +
      'var m=e.data;google.script.run.withSuccessHandler(function(v){top.postMessage({type:"ivl-result",id:m.id,session:SESSION,ok:true,value:v},ORIGIN)})' +
      '.withFailureHandler(function(err){top.postMessage({type:"ivl-result",id:m.id,session:SESSION,ok:false,error:(err&&err.message)||String(err)},ORIGIN)})' +
      '.apiBridgeCall({action:m.action,payload:m.payload||{}});' +
      '});top.postMessage({type:"ivl-ready",session:SESSION},ORIGIN);</script>';
    return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
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
      case 'bootstrapState':
        if (!body.state || typeof body.state !== 'object') return { ok: false, error: 'Missing state' };
        saveAppState_(body.state);
        return { ok: true, bytes: JSON.stringify(body.state).length };
      case 'reconcileState':
        const state = loadAppState_();
        if (!state) return { ok: false, error: 'The Lab has not been initialized.' };
        const result = reconcileState_(state, body.tabs);
        saveAppState_(state);
        return { ok: true, result: result };
      case 'migrateLongTermV2':
        return migrateLongTermV2_();
      case 'repairLongTermV2':
        return repairLongTermV2_();
      case 'repairMovedShortTermV2':
        return repairMovedShortTermV2_();
      case 'mutateState': {
        const mutableState = loadAppState_();
        if (!mutableState) return { ok: false, error: 'The Lab has not been initialized.' };
        const mutationResult = mutateState_(mutableState, body.mutation || {});
        saveAppState_(mutableState);
        syncMutationToSheets_(mutableState, body.mutation || {}, mutationResult.id);
        return { ok: true, id: mutationResult.id };
      }
      case 'upsertVenture': {
        const ventureState = loadAppState_();
        if (!ventureState) return { ok: false, error: 'The Lab has not been initialized.' };
        const ventureData = body.data || {};
        const wantedTitle = String(ventureData.title || '').trim();
        if (!wantedTitle || !ventureData.ventureTrack) return { ok: false, error: 'A title and ventureTrack are required.' };
        let venture = (ventureState.ideas || []).find(function(item) { return !item.deletedAt && String(item.title || '').trim().toLowerCase() === wantedTitle.toLowerCase(); });
        let created = false;
        if (venture) {
          Object.assign(venture, cleanStateInput_(ventureData), { updatedAt: new Date().toISOString() });
        } else {
          const createdResult = mutateState_(ventureState, { op:'create',collection:'ideas',data:ventureData });
          venture = ventureState.ideas.find(function(item) { return item.id === createdResult.id; });
          created = true;
        }
        saveAppState_(ventureState);
        return { ok: true, id: venture.id, created: created };
      }
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
      const tab = locateTab_(key) || createManagedTab_(key);
      if (!tab) {
        log.push(key + ': tab not found — skipped');
        return;
      }
      ensureSystemColumns_(tab);
      styleSystemColumns_(tab);
      styleAuthorityColumns_(tab);
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

// One-time conversion from the old medium-term opportunity catalog to a true
// multi-year strategy sheet. Tactical bridge work moves to Short-Term; detailed
// business/product ideas remain available on the site; the long workbook becomes
// the durable 1/3/5/10-year planning source.
function migrateLongTermV2_() {
  const prepared = withLock_(function() {
    const state = loadAppState_();
    if (!state) throw new Error('The Lab has not been initialized.');
    if ((state.ideas || []).some(function(i) { return !i.deletedAt && i.source === 'strategy-v2'; })) {
      return { alreadyMigrated:true, shortOps:[], moved:0, preserved:0, strategies:0 };
    }

    const now = new Date().toISOString();
    const normalizeTitle = function(value) { return String(value || '').trim().toLowerCase(); };
    const tacticalTitles = {
      'tutoring / test prep':true, 'pet care / dog walking':true, 'home organizing / move support':true,
      'handyman / furniture assembly':true, 'reselling / flipping':true,
    };
    const businessTypes = {
      'Service Business':true, 'Ecommerce':true, 'Reselling':true, 'Digital Product':true,
      'Consumer Product':true, 'Technology Product':true, 'Company Concept':true,
      'Content':true, 'Software':true, 'Acquisition':true,
    };
    const shortOps = [];
    let moved = 0, preserved = 0;

    (state.ideas || []).forEach(function(idea) {
      if (idea.deletedAt || idea.ventureTrack || idea.horizon !== 'Long Term' || idea.source === 'strategy-v2') return;
      const title = normalizeTitle(idea.title);
      const tactical = idea.category === 'Bridge Income' || idea.category === 'Freelance' || tacticalTitles[title];
      if (tactical) {
        const duplicate = (state.ideas || []).find(function(other) {
          return other.id !== idea.id && !other.deletedAt && other.horizon === 'Short Term' && normalizeTitle(other.title) === title;
        });
        if (duplicate) {
          idea.deletedAt = now;
          idea.updatedAt = now;
          preserved++;
        } else {
          idea.horizon = 'Short Term';
          idea.updatedAt = now;
          shortOps.push({ tab:'shortIdeas',syncId:idea.syncId,op:'upsert',values:recordValues_('shortIdeas', idea) });
          moved++;
        }
      } else {
        idea.ventureTrack = businessTypes[idea.opportunityType] ? 'Venture Studio' : 'Idea Vault';
        idea.updatedAt = now;
        preserved++;
      }
    });

    const definitions = longTermStrategyDefinitions_();
    definitions.forEach(function(def) {
      const record = Object.assign(defaultRecord_('ideas'), def, {
        id:Utilities.getUuid(), syncId:Utilities.getUuid(), source:'strategy-v2', sourceWorkbook:'long',
        sourceSheet:'Long-Term Strategy', sourceRow:null, importedAt:now, horizon:'Long Term', ventureTrack:null,
        createdAt:now, updatedAt:now, deletedAt:null, details:{},
      });
      state.ideas.push(record);
    });

    const book = SpreadsheetApp.openById(WORKBOOKS.long);
    const legacySheet = book.getSheetByName('Long-Term Strategy') || book.getSheetByName('Income Options');
    if (!legacySheet) throw new Error('The long-term strategy tab could not be found.');
    const backupName = 'Income Options Backup 2026-09-21';
    if (!book.getSheetByName(backupName)) {
      legacySheet.copyTo(book).setName(backupName).setTabColor('#9aa7a3');
    }
    let legacyName = 'Income Options Legacy Table';
    let suffix = 2;
    while (book.getSheetByName(legacyName) && book.getSheetByName(legacyName).getSheetId() !== legacySheet.getSheetId()) legacyName = 'Income Options Legacy Table ' + suffix++;
    if (legacySheet.getName() !== legacyName) legacySheet.setName(legacyName);
    const sheet = book.insertSheet('Long-Term Strategy', 0);
    const headers = [
      'Strategic Role','Strategy / Path','Why It Matters','Income Engine','Involvement',
      '1-Year Foundation','3-Year Position','5-Year Outcome','10-Year Vision','Durable Advantage','Key Dependencies',
      'Starting Capital Low','Starting Capital High','Weekly Hours (Year 1)','Long-Term Monthly Income Low','Long-Term Monthly Income High',
      'Risk Comfort 1-5','Passive Potential 1-5','Status','Next 12-Month Move','Success Measure','Notes',
      '_sync_id','_updated_at','_version','_deleted','_source',
    ];
    const rows = [headers];
    definitions.forEach(function(def, index) {
      const record = state.ideas[state.ideas.length - definitions.length + index];
      const values = recordValues_('longIdeas', record);
      rows.push(headers.map(function(header) {
        const key = normHeader_(header);
        if (key === '_sync_id') return record.syncId;
        if (key === '_updated_at') return now;
        if (key === '_version') return 1;
        if (key === '_deleted') return false;
        if (key === '_source') return 'strategy-v2';
        return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
      }));
    });

    const headerRow = 1;
    definitions.forEach(function(_def, index) {
      state.ideas[state.ideas.length - definitions.length + index].sourceRow = headerRow + index + 1;
    });
    if (sheet.getMaxRows() < headerRow + definitions.length) sheet.insertRowsAfter(sheet.getMaxRows(), headerRow + definitions.length - sheet.getMaxRows());
    if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    const width = headers.length;
    sheet.getRange(headerRow, 1, rows.length, headers.length).setValues(rows);
    sheet.setFrozenRows(headerRow);
    sheet.getRange(headerRow, 1, rows.length, 22).createFilter();
    sheet.getRange(headerRow, 1, 1, width).setBackground('#163f3a').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sheet.getRange(headerRow + 1, 1, rows.length - 1, 22).setVerticalAlignment('top').setWrap(true);
    sheet.setRowHeight(headerRow, 42);
    for (let r = headerRow + 1; r <= headerRow + definitions.length; r++) sheet.setRowHeight(r, 86);
    [1,4,5,17,18,19].forEach(function(c) { sheet.setColumnWidth(c, 125); });
    [2,3,6,7,8,9,10,11,20,21,22].forEach(function(c) { sheet.setColumnWidth(c, 230); });
    [12,13,14,15,16].forEach(function(c) { sheet.setColumnWidth(c, 115); });
    const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['Exploring','Focus Now','Building','Running','Paused'], true).setAllowInvalid(false).build();
    const involvementRule = SpreadsheetApp.newDataValidation().requireValueInList(['Active','Hybrid','Passive-ish'], true).setAllowInvalid(false).build();
    sheet.getRange(headerRow + 1, 19, rows.length - 1, 1).setDataValidation(statusRule);
    sheet.getRange(headerRow + 1, 5, rows.length - 1, 1).setDataValidation(involvementRule);
    headers.forEach(function(h, i) { if (HIDDEN_SYSTEM_COLUMNS.indexOf(normHeader_(h)) !== -1) sheet.hideColumns(i + 1); });
    PropertiesService.getScriptProperties().setProperty('longTermStrategyGid', String(sheet.getSheetId()));

    state.sync = Object.assign({}, state.sync || {}, { lastRunAt:now,lastSuccessAt:now,lastError:null,health:'synced',sheets:currentSyncSheets_() });
    addHistory_(state, null, 'system', 'long-term-v2', 'migrated', 'Rebuilt Long-Term Income around 1, 3, 5, and 10-year strategy horizons');
    saveAppState_(state);
    return { alreadyMigrated:false, shortOps:shortOps, moved:moved, preserved:preserved, strategies:definitions.length };
  });
  const shortResults = prepared.shortOps.length ? writeOps_(prepared.shortOps) : [];
  return { ok:true,alreadyMigrated:prepared.alreadyMigrated,movedToShort:prepared.moved,preservedAsSiteIdeas:prepared.preserved,strategiesCreated:prepared.strategies,shortResults:shortResults };
}

// Idempotent follow-up for tactical rows moved by migrateLongTermV2_. The old
// long workbook used statuses that are not valid in the Short-Term table, so
// normalize those rows and make sure each one physically exists in Income Ideas.
function repairMovedShortTermV2_() {
  const prepared = withLock_(function() {
    const state = loadAppState_();
    if (!state) throw new Error('The Lab has not been initialized.');
    const tacticalTitles = {
      'tutoring / test prep':true, 'pet care / dog walking':true, 'home organizing / move support':true,
      'handyman / furniture assembly':true, 'reselling / flipping':true,
    };
    const allowedStatuses = { 'Shortlist':true, 'Consider':true, 'Research':true, 'Avoid for now':true, 'No':true };
    const now = new Date().toISOString();
    const repaired = [];
    (state.ideas || []).forEach(function(idea) {
      if (idea.deletedAt || idea.ventureTrack || idea.horizon !== 'Short Term') return;
      const title = String(idea.title || '').trim().toLowerCase();
      const cameFromLong = idea.sourceWorkbook === 'long' || idea.sourceSheet === 'Income Options' || idea.sourceSheet === 'Long-Term Strategy';
      const tactical = idea.category === 'Bridge Income' || idea.category === 'Freelance' || tacticalTitles[title];
      if (!cameFromLong || !tactical || String(idea.status || '').trim() === 'No') return;
      if (!allowedStatuses[String(idea.status || '').trim()]) idea.status = 'Consider';
      if (!String(idea.tier || '').trim()) idea.tier = 'C';
      if (!String(idea.personalFitAngle || '').trim()) idea.personalFitAngle = idea.description || 'Temporary or bridge-income option.';
      idea.updatedAt = now;
      repaired.push(idea);
    });
    saveAppState_(state);
    return repaired.map(function(idea) {
      return { tab:'shortIdeas',syncId:idea.syncId,op:'upsert',values:recordValues_('shortIdeas', idea) };
    });
  });
  const results = prepared.length ? writeOps_(prepared) : [];
  return {
    ok: results.every(function(result) { return result.ok; }),
    attempted: prepared.length,
    written: results.filter(function(result) { return result.ok; }).length,
    results: results,
  };
}

function longTermStrategyDefinitions_() {
  return [
    { strategicRole:'Primary income',category:'Career & Skills',title:'Career capital and primary income growth',opportunityType:'Employment / Bridge Income',description:'Build dependable earning power, benefits, leverage, and optionality through skills, responsibility, and a strong professional network.',howItEarns:'Salary, benefits, bonuses, and higher-value roles',incomeStyle:'Active',year1:'Choose a durable career direction, close the most valuable skill gap, and stabilize primary income.',year3:'Hold a stronger role with demonstrable results, a wider network, and increased compensation.',year5:'Reach senior or specialized earning power with multiple credible employer or client options.',year10:'Maintain resilient high-value work by choice, with financial independence reducing dependence on any one employer.',durableAdvantage:'Skills, reputation, network, and a documented record of outcomes',dependencies:'Consistent skill development, portfolio proof, relationship building, and market demand',startupLow:0,startupHigh:10000,weeklyHours:40,monthlyLow:5000,monthlyHigh:20000,riskComfort:4,passivePotential:1,status:'Focus Now',firstTest:'Define the next role and the one skill or credential most likely to improve access within 12 months.',successMeasure:'Primary income, benefits, role quality, and the number of viable next-step options',notes:'Temporary gig work belongs in Short-Term; this path is about compounding career value.' },
    { strategicRole:'Expertise income',category:'Consulting',title:'Specialized consulting or fractional practice',opportunityType:'Service Business',description:'Turn professional expertise into a focused, repeatable offer that can become a durable independent income stream.',howItEarns:'Diagnostics, projects, retainers, and fractional leadership',incomeStyle:'Active',year1:'Choose a niche, define one paid offer, earn initial proof, and build a referral-ready body of work.',year3:'Develop recurring clients, clear positioning, repeatable delivery, and selective pricing power.',year5:'Operate a durable boutique practice or small firm with systems and recurring revenue.',year10:'Own a respected expertise business that can remain intentionally small, scale with a team, or produce licensable IP.',durableAdvantage:'Specialized knowledge, trust, case studies, referrals, and proprietary methods',dependencies:'Credibility, network, demand, sales discipline, delivery capacity, and professional safeguards',startupLow:500,startupHigh:15000,weeklyHours:10,monthlyLow:3000,monthlyHigh:30000,riskComfort:3,passivePotential:2,status:'Exploring',firstTest:'Package one narrow paid diagnostic and validate it with five qualified conversations.',successMeasure:'Recurring client revenue, referral rate, effective hourly value, and concentration risk',notes:'' },
    { strategicRole:'Business ownership',category:'Owned Business',title:'Owned service business',opportunityType:'Service Business',description:'Build a local or specialized service company whose value comes from recurring demand, operating systems, and eventually a team.',howItEarns:'Recurring service revenue and operating margin',incomeStyle:'Hybrid',year1:'Validate one service, pricing model, customer segment, and reliable acquisition channel.',year3:'Create repeatable operations, recurring customers, and the first dependable delegation layer.',year5:'Own a manager-supported operation with healthy margins and reduced dependence on the founder.',year10:'Hold a durable cash-flow business that can be retained, expanded, or sold.',durableAdvantage:'Local reputation, repeat customers, route density, process quality, and trained people',dependencies:'Demand, hiring, quality control, insurance, licensing, and working capital',startupLow:1000,startupHigh:50000,weeklyHours:15,monthlyLow:5000,monthlyHigh:50000,riskComfort:3,passivePotential:3,status:'Exploring',firstTest:'Select one service-business idea and validate real demand before buying meaningful equipment.',successMeasure:'Recurring revenue, operating margin, owner hours, retention, and documented systems',notes:'Individual service concepts remain in Business and Brand Ideas on the site.' },
    { strategicRole:'Brand ownership',category:'Products & Brands',title:'Peculiar Candle and product-brand portfolio',opportunityType:'Consumer Product',description:'Develop Peculiar Candle as a real brand and use what it teaches to build enduring product, marketing, and customer assets.',howItEarns:'Product margin, repeat purchases, wholesale, and direct-to-consumer sales',incomeStyle:'Hybrid',year1:'Validate the hero products, brand position, unit economics, repeat demand, and a manageable selling rhythm.',year3:'Build repeat customers, reliable production, channel fit, and a recognizable brand identity.',year5:'Operate a profitable product brand with a broader assortment or carefully chosen wholesale presence.',year10:'Own a durable brand or portfolio with systems, intellectual property, loyal customers, and strategic exit options.',durableAdvantage:'Brand meaning, product quality, customer loyalty, formulations, packaging, and distribution',dependencies:'Safe production, margins, demand, cash flow, supply chain, and consistent marketing',startupLow:500,startupHigh:30000,weeklyHours:12,monthlyLow:2000,monthlyHigh:40000,riskComfort:3,passivePotential:2,status:'Building',firstTest:'Finish the Peculiar Candle business plan and validate a small hero collection with paying customers.',successMeasure:'Contribution margin, repeat purchase rate, customer acquisition cost, and founder capacity',notes:'' },
    { strategicRole:'Intellectual property',category:'Scalable Products',title:'Digital products, education, and licensable IP',opportunityType:'Digital Product',description:'Convert useful knowledge, systems, or creative work into assets that can sell repeatedly without equal growth in delivery hours.',howItEarns:'Product sales, licenses, subscriptions, memberships, or royalties',incomeStyle:'Passive-ish',year1:'Validate one narrow problem and sell a small useful product before building a library.',year3:'Develop a focused catalog, owned audience, and repeatable launch or evergreen sales system.',year5:'Create meaningful recurring or repeatable income from a trusted body of intellectual property.',year10:'Own an adaptable IP portfolio that produces income across channels and can support other businesses.',durableAdvantage:'Original frameworks, audience trust, product library, distribution, and accumulated customer insight',dependencies:'Real usefulness, discoverability, audience access, maintenance, and intellectual-property discipline',startupLow:100,startupHigh:15000,weeklyHours:8,monthlyLow:500,monthlyHigh:25000,riskComfort:3,passivePotential:5,status:'Exploring',firstTest:'Pre-sell one narrowly defined template, toolkit, class, or guide to a specific audience.',successMeasure:'Sales per asset, repeat buyers, owned audience growth, and maintenance hours',notes:'' },
    { strategicRole:'Technology ownership',category:'Software',title:'Software, automation, or technology product',opportunityType:'Technology Product',description:'Build or own a focused technology product that solves a persistent problem and can create recurring revenue or strategic value.',howItEarns:'Subscriptions, licenses, usage fees, or acquisition value',incomeStyle:'Hybrid',year1:'Choose one real problem, secure design partners, and validate willingness to pay before a large build.',year3:'Reach product-market evidence with retained users, reliable operations, and a focused product.',year5:'Operate a durable software business or valuable technology asset with recurring revenue.',year10:'Own a mature technology product, portfolio, or intellectual property with strategic sale or continuing-income options.',durableAdvantage:'Product insight, customer workflows, data, integrations, code, and switching costs',dependencies:'Technical capability, security, distribution, support, retention, and ongoing development',startupLow:500,startupHigh:75000,weeklyHours:10,monthlyLow:1000,monthlyHigh:50000,riskComfort:2,passivePotential:4,status:'Exploring',firstTest:'Interview five target users and secure a paid manual or no-code pilot before engineering deeply.',successMeasure:'Retention, recurring revenue, support burden, gross margin, and product usage',notes:'Smart Mirror can remain an invention concept until its problem and business case are clear.' },
    { strategicRole:'Audience asset',category:'Media & Audience',title:'Owned audience and media asset',opportunityType:'Content',description:'Build direct access to a defined audience that can support sponsorships, products, services, memberships, and future ventures.',howItEarns:'Sponsorships, memberships, affiliates, products, and qualified demand for other offers',incomeStyle:'Hybrid',year1:'Choose a useful editorial focus, publish consistently, and establish an owned email audience.',year3:'Develop audience trust, repeatable distribution, and two complementary monetization methods.',year5:'Operate a meaningful media or community asset with diversified revenue and owned customer relationships.',year10:'Own a recognized audience platform that supports a portfolio of products, businesses, or investments.',durableAdvantage:'Trust, archives, subscriber relationships, brand recognition, and distribution',dependencies:'Consistency, distinct point of view, audience need, platform diversification, and measurement',startupLow:100,startupHigh:20000,weeklyHours:8,monthlyLow:500,monthlyHigh:30000,riskComfort:3,passivePotential:3,status:'Exploring',firstTest:'Publish a six-piece minimum viable series and track qualified subscribers rather than views alone.',successMeasure:'Owned subscribers, retention, engagement quality, revenue diversity, and content reuse',notes:'' },
    { strategicRole:'Asset income',category:'Income-Producing Assets',title:'Income-producing physical assets and rental operations',opportunityType:'Asset',description:'Own useful physical assets that generate rental or usage income with clear maintenance, insurance, and utilization economics.',howItEarns:'Rental fees and asset utilization',incomeStyle:'Hybrid',year1:'Test demand using one existing, borrowed, or low-cost asset and document true net economics.',year3:'Own a focused set of well-utilized assets with reliable booking, deposits, and maintenance systems.',year5:'Operate a diversified asset portfolio with disciplined replacement and risk controls.',year10:'Hold a durable income-producing asset base that complements businesses and investments.',durableAdvantage:'Local demand knowledge, utilization data, reliable operations, asset quality, and customer trust',dependencies:'Capital, storage, insurance, damage controls, maintenance, regulation, and utilization',startupLow:500,startupHigh:100000,weeklyHours:5,monthlyLow:500,monthlyHigh:15000,riskComfort:3,passivePotential:4,status:'Exploring',firstTest:'Choose one asset category and validate paid demand without purchasing a large inventory.',successMeasure:'Net yield on asset cost, utilization, damage/loss rate, maintenance hours, and payback period',notes:'Vending, equipment, vehicles, and space should be evaluated by net economics—not labeled passive by default.' },
    { strategicRole:'Property wealth',category:'Real Estate',title:'Real-estate ownership and property income',opportunityType:'Property',description:'Use carefully selected property ownership to build long-duration cash flow, equity, inflation resilience, or strategic flexibility.',howItEarns:'Net rent, amortization, and long-term appreciation',incomeStyle:'Passive-ish',year1:'Build readiness: credit, reserves, market knowledge, underwriting discipline, and clear buy criteria.',year3:'Own only if a property meets conservative cash-flow, reserve, legal, and lifestyle requirements.',year5:'Stabilize operations and decide whether to hold one strong asset or deliberately expand.',year10:'Hold a resilient property position that contributes cash flow and equity without endangering liquidity.',durableAdvantage:'Patient underwriting, favorable basis, financing discipline, operational competence, and time',dependencies:'Capital, credit, reserves, location, regulation, insurance, repairs, vacancy, and management',startupLow:15000,startupHigh:250000,weeklyHours:3,monthlyLow:0,monthlyHigh:10000,riskComfort:2,passivePotential:4,status:'Exploring',firstTest:'Define conservative purchase criteria and analyze ten realistic properties including vacancy, repairs, taxes, and reserves.',successMeasure:'Cash-on-cash return, debt coverage, reserves, vacancy, equity, and owner time',notes:'' },
    { strategicRole:'Financial assets',category:'Investing',title:'Diversified long-term investment portfolio',opportunityType:'Investment',description:'Build a diversified portfolio aligned with liquidity needs, risk capacity, taxes, and long-term independence rather than short-term income pressure.',howItEarns:'Interest, dividends, and long-term capital appreciation',incomeStyle:'Passive-ish',year1:'Protect emergency liquidity, define an investment policy, use appropriate accounts, and establish sustainable contributions.',year3:'Maintain consistent contributions and a diversified allocation through different market conditions.',year5:'Grow a meaningful invested base while keeping fees, taxes, concentration, and behavior under control.',year10:'Hold a substantial diversified portfolio that increases choice and reduces dependence on earned income.',durableAdvantage:'Time, diversification, low costs, tax efficiency, discipline, and consistent contributions',dependencies:'Surplus cash flow, emergency reserves, risk capacity, appropriate accounts, and a sound policy',startupLow:0,startupHigh:100000,weeklyHours:1,monthlyLow:0,monthlyHigh:10000,riskComfort:3,passivePotential:5,status:'Focus Now',firstTest:'Write a simple investment policy and confirm the emergency-fund and account sequence before increasing risk.',successMeasure:'Savings rate, invested assets, diversification, fees, progress to independence, and adherence to policy',notes:'Market levels and yields remain externally sourced in the Investing & Assets Lab.' },
    { strategicRole:'Acquisition',category:'Business Ownership',title:'Acquire an existing cash-flowing business',opportunityType:'Acquisition',description:'Purchase an operating company only when its earnings quality, financing, risks, and operational demands are deeply understood.',howItEarns:'Operating cash flow, debt paydown, and enterprise value growth',incomeStyle:'Hybrid',year1:'Learn acquisition economics, lender requirements, diligence, and operator fit without rushing to transact.',year3:'Build capital, advisory relationships, and a disciplined acquisition thesis; review real opportunities.',year5:'Acquire only if a business meets strict earnings-quality, concentration, financing, and operating criteria.',year10:'Own a strong operating company or small portfolio with professional systems and multiple strategic options.',durableAdvantage:'Purchased customer base, proven operations, seller knowledge, disciplined underwriting, and operational improvement',dependencies:'Capital, financing, diligence, legal and accounting support, leadership ability, and deal quality',startupLow:25000,startupHigh:750000,weeklyHours:10,monthlyLow:5000,monthlyHigh:75000,riskComfort:1,passivePotential:3,status:'Exploring',firstTest:'Review twenty listings and speak with a lender and acquisition professional before treating this as actionable.',successMeasure:'Quality of earnings, debt coverage, customer concentration, owner dependence, and return on invested capital',notes:'' },
    { strategicRole:'Portfolio design',category:'Whole Income System',title:'Resilient multi-stream income portfolio',opportunityType:'Other',description:'Coordinate primary work, owned businesses, scalable assets, and investments so no single source has to carry the entire financial future.',howItEarns:'A deliberate mix of earned, business, asset, and investment income',incomeStyle:'Hybrid',year1:'Stabilize the base, choose one primary build path, protect liquidity, and stop scattering effort across too many experiments.',year3:'Maintain dependable primary income plus one proven secondary engine and consistent investing.',year5:'Increase the share of income and net worth coming from owned businesses and assets without weakening resilience.',year10:'Reach a balanced position where work is increasingly chosen and several durable engines support the household.',durableAdvantage:'Diversification across income types, coordinated capital allocation, and years of accumulated proof',dependencies:'Focus, cash-flow discipline, regular review, risk limits, and sequencing one build at a time',startupLow:0,startupHigh:100000,weeklyHours:5,monthlyLow:0,monthlyHigh:100000,riskComfort:4,passivePotential:4,status:'Focus Now',firstTest:'Choose the one primary path and one supporting financial habit for the next 12 months.',successMeasure:'Income concentration, savings rate, owned-asset income, liquidity, net worth, and hours required',notes:'This is the coordinating strategy—not another project competing for attention.' },
  ];
}

function repairLongTermV2_() {
  return withLock_(function() {
    const state = loadAppState_();
    if (!state) throw new Error('The Lab has not been initialized.');
    const book = SpreadsheetApp.openById(WORKBOOKS.long);
    const sheet = book.getSheetByName('Long-Term Strategy');
    if (!sheet) throw new Error('Long-Term Strategy was not found.');
    const scanRows = Math.min(20, sheet.getLastRow());
    const scanCols = Math.min(30, sheet.getLastColumn());
    const grid = sheet.getRange(1, 1, scanRows, scanCols).getDisplayValues();
    let headerRow = 0;
    grid.some(function(row, index) {
      const normalized = row.map(normHeader_);
      if (normalized.indexOf('strategy / path') >= 0 && normalized.indexOf('10-year vision') >= 0 && index > 0) {
        headerRow = index + 1;
        return true;
      }
      return false;
    });
    if (!headerRow) throw new Error('The native strategy table header was not found.');
    if (headerRow > 1) {
      sheet.getRange(1, 1, headerRow - 1, scanCols).clearContent().clearFormat();
      sheet.hideRows(1, headerRow - 1);
    }
    sheet.setFrozenRows(headerRow);
    const strategies = (state.ideas || []).filter(function(i) { return !i.deletedAt && i.source === 'strategy-v2'; });
    strategies.forEach(function(record, index) {
      record.sourceSheet = 'Long-Term Strategy';
      record.sourceRow = headerRow + index + 1;
    });
    const beforeCleanup = (state.ideas || []).length;
    state.ideas = (state.ideas || []).filter(function(idea) {
      const title = String(idea.title || '').trim().toLowerCase();
      const description = String(idea.description || '').trim().toLowerCase();
      return !(title === 'strategy / path' && description === 'why it matters');
    });
    if (state.sheetRows && state.sheetRows._sync_id) delete state.sheetRows._sync_id;
    const artifactsRemoved = beforeCleanup - state.ideas.length;
    const now = new Date().toISOString();
    state.sync = Object.assign({}, state.sync || {}, { lastRunAt:now,lastSuccessAt:now,lastError:null,health:'synced',sheets:currentSyncSheets_() });
    saveAppState_(state);
    return { ok:true,headerRow:headerRow,duplicatesCleared:headerRow - 1,strategies:strategies.length,artifactsRemoved:artifactsRemoved };
  });
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

    // Keep the site's saved state current when a person edits a managed Sheet.
    // Only the affected tab is reconciled; externally sourced investment facts
    // remain protected by the field-authority map in reconcileState_.
    const state = loadAppState_();
    if (state && entry.tab) {
      reconcileState_(state, [entry.tab]);
      saveAppState_(state);
    }
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

function createManagedTab_(key) {
  const cfg = TABS[key];
  if (!cfg.createHeaders) return null;
  const ss = SpreadsheetApp.openById(WORKBOOKS[cfg.workbook]);
  const sheet = ss.getSheetByName(cfg.names[0]) || ss.insertSheet(cfg.names[0]);
  sheet.clear();
  sheet.getRange(1, 1, 1, cfg.createHeaders.length).setValues([cfg.createHeaders]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, cfg.createHeaders.length)
    .setBackground('#173934').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  sheet.autoResizeColumns(1, cfg.createHeaders.length);
  return buildTab_(key, cfg, ss, sheet, 1);
}

function styleAuthorityColumns_(tab) {
  const owned = tab.cfg.appOwned || [];
  owned.forEach(header => {
    const col = tab.col[header];
    if (!col) return;
    const range = tab.sheet.getRange(1, col, tab.sheet.getMaxRows(), 1);
    range.setBackground('#eef3f8');
    tab.sheet.getRange(tab.headerRow, col).setBackground('#35566f').setFontColor('#ffffff')
      .setNote('Source- or application-authoritative. Manual edits are replaced by the next verified refresh.');
  });
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

// ---------------------------------------------------------------------------
// GitHub Pages application API
// ---------------------------------------------------------------------------

// Header, state field, value type, authority. Fields marked `app` are never
// accepted from Sheets; verified external/calculated data always wins.
const STATE_TAB_MAPS = {
  shortIdeas: ['status:status:t','tier:tier:t','category:category:t','opportunity:title:t','personal fit / angle:personalFitAngle:t','first cash:firstCash:t','startup cost:startupLow:n','weekly hrs:weeklyHours:n','income model:incomeModel:t','low monthly:monthlyLow:n','high monthly:monthlyHigh:n','speed 1-5:speed:n','fit 1-5:fit:n','demand 1-5:demand:n','scale 1-5:scale:n','low cost 1-5:lowCost:n','low risk 1-5:lowRisk:n','score /100:sheetShortScore:n:app','first test:firstTest:t'],
  longIdeas: ['strategic role:strategicRole:t','strategy / path:title:t','why it matters:description:t','income engine:howItEarns:t','involvement:incomeStyle:t','1-year foundation:year1:t','3-year position:year3:t','5-year outcome:year5:t','10-year vision:year10:t','durable advantage:durableAdvantage:t','key dependencies:dependencies:t','starting capital low:startupLow:n','starting capital high:startupHigh:n','weekly hours (year 1):weeklyHours:n','long-term monthly income low:monthlyLow:n','long-term monthly income high:monthlyHigh:n','risk comfort 1-5:riskComfort:n','passive potential 1-5:passivePotential:n','status:status:t','next 12-month move:firstTest:t','success measure:successMeasure:t','notes:notes:t'],
  experiments: ['idea:ideaLabel:t','status:status:t','start date:startDate:d','decision date:decisionDate:d','hypothesis:hypothesis:t','test action:testAction:t','budget:budget:n','hours:actualHours:n','leads:leads:n','replies:replies:n','sales:sales:n','revenue:revenue:n','direct cost:directCosts:n','net cash:sheetNetCash:n:app','net $/hr:sheetNetHourly:n:app','decision / learning:learning:t'],
  sprint: ['day:day:t','status:status:t','action:action:t','deliverable:deliverable:t','time:time:t','cost cap:costCap:n','success signal:successSignal:t','result / notes:resultNotes:t'],
  plan: ['month:month:n','income path:ideaLabel:t','stage:stage:t','milestone / hypothesis:title:t','target date:targetDate:d','time budget hrs:timeBudget:n','spending cap:spendingCap:n','target monthly income:targetIncome:n','actual monthly income:actualIncome:n','status:status:t','next action:nextAction:t','evidence / decision notes:evidenceNotes:t'],
  costs: ['income path:ideaLabel:t','expense category:category:t','cost type:costType:t','expense item:item:t','low estimate:low:n','high estimate:high:n','actual:actual:n','essential?:essential:t','due / start date:dueDate:d','notes / vendor:notes:t'],
  investments: ['status:status:t','classification:classification:t','category:category:t','investment / account:name:t','symbol / series:symbol:t','account or asset:accountOrAsset:t','definition:definition:t','how it earns:returnMechanism:t','typical horizon:horizon:t','liquidity:liquidity:t','income frequency:incomeFrequency:t','market risk:riskMarket:t:app','principal risk:riskPrincipal:t:app','credit risk:riskCredit:t:app','interest rate risk:riskInterestRate:t:app','inflation risk:riskInflation:t:app','complexity:riskComplexity:t:app','passive level:passiveLevel:t','minimum / access notes:minimumAccessNotes:t','fees / expense notes:feesExpenseNotes:t','tax / account notes:taxAccountNotes:t','benchmark:benchmark:t','current metric:currentMetric:t:app','current value:currentValue:n:app','observation date:observationDate:d:app','data source:dataSource:t:app','ytd %:ytdPct:n:app','1y %:oneYearPct:n:app','5y annualized %:fiveYearAnnualizedPct:n:app','interest 1-5:personalInterest:n','understanding 1-5:personalUnderstanding:n','risk comfort 1-5:riskComfort:n','research status:researchStatus:t','first experiment:firstExperiment:t','notes:notes:t','last reviewed:lastReviewed:d'],
  investmentExperiments: ['investment sync id:investmentSyncId:t:app','investment:investmentLabel:t','experiment:name:t','mode:mode:t','status:status:t','hypothesis:hypothesis:t','benchmark:benchmark:t','start date:startDate:d','review date:reviewDate:d','starting amount:startingAmount:n','recurring contribution:recurringContribution:n','start price / level:startPrice:n','current price / level:currentPrice:n:app','current value:currentValue:n:app','return $:returnDollars:n:app','return %:returnPct:n:app','fees:fees:n','learning:learning:t','decision:finalDecision:t','data source:dataSource:t:app','last refreshed:lastRefreshed:d:app'],
};

const TAB_COLLECTION = { shortIdeas: 'ideas', longIdeas: 'ideas', experiments: 'experiments', sprint: 'sprint', plan: 'milestones', costs: 'expenses', investments: 'investments', investmentExperiments: 'investmentExperiments' };
const COLLECTION_TABS = { ideas: ['shortIdeas', 'longIdeas'], experiments: ['experiments'], sprint: ['sprint'], milestones: ['plan'], expenses: ['costs'], investments: ['investments'], investmentExperiments: ['investmentExperiments'] };
const PROTECTED_STATE_FIELDS = ['id','syncId','createdAt','updatedAt','deletedAt','source','sourceWorkbook','sourceSheet','sourceRow','importedAt','sheetRef','sheetShortScore','sheetFitScore','overallEffort','sheetNetCash','sheetNetHourly','currentMetric','currentValue','observationDate','dataSource','ytdPct','oneYearPct','fiveYearAnnualizedPct','currentPrice','returnDollars','returnPct','lastRefreshed','riskProfile'];
const SYNC_SHEETS = { shortIdeas:{sheetName:'Income Ideas',gid:302757590},longIdeas:{sheetName:'Long-Term Strategy',gid:126322697},experiments:{sheetName:'Short Term Income Tracker',gid:29828859},sprint:{sheetName:'Actualizing Template',gid:1884519258},plan:{sheetName:'12-Month Plan',gid:401181688},costs:{sheetName:'Cost Planner',gid:1272715874},investments:{sheetName:'Investing & Assets',gid:777753465},investmentExperiments:{sheetName:'Investment Experiments',gid:97191746},guardrails:{sheetName:'Instructions',gid:1324825440} };

function currentSyncSheets_() {
  const sheets = JSON.parse(JSON.stringify(SYNC_SHEETS));
  const gid = Number(PropertiesService.getScriptProperties().getProperty('longTermStrategyGid') || 0);
  if (gid) sheets.longIdeas.gid = gid;
  return sheets;
}

function mapFields_(key) {
  return (STATE_TAB_MAPS[key] || []).map(function(spec) {
    const p = spec.split(':'); return { header: p[0], field: p[1], type: p[2], app: p[3] === 'app' };
  });
}

function apiBridgeCall(request) {
  const action = request && request.action;
  const payload = (request && request.payload) || {};
  let state = loadAppState_();
  if (!state) throw new Error('The Lab has not been initialized.');
  if (action === 'state') return publicState_(state);
  if (action === 'investmentData') return { metrics: state.investmentMetrics || [], sources: state.investmentSources || [], rules: state.investmentRules || [], marketQuoteProvider: 'Official-source observations are refreshed by the Lab; security quotes require a configured provider.' };
  if (action === 'mutate') {
    const result = mutateState_(state, payload.mutation || {});
    saveAppState_(state);
    syncMutationToSheets_(state, payload.mutation || {}, result.id);
    return { id: result.id, state: publicState_(state) };
  }
  if (action === 'sync') {
    const setupLog = payload.action === 'setup' ? setup() : null;
    const result = reconcileState_(state, payload.tabs);
    saveAppState_(state);
    return { state: publicState_(state), result: result, setupLog: setupLog };
  }
  throw new Error('Unknown application action: ' + action);
}

const STATE_SHEET_NAME = '_IVL_AppState';
const STATE_SPREADSHEET_ID = '';
const STATE_CELL_CHUNK = 2000;
// Filled app state JSON on Drive (avoids Script Properties ~500KB quota).
const STATE_DRIVE_FILE_ID = '1cus9f8gQMnV9qaBYIH3X7BnzEESQ20_f'; // filled offline JSON; sheet is primary

function getStateSheet_() {
  if (STATE_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(STATE_SPREADSHEET_ID).getSheets()[0];
  }
  const ss = SpreadsheetApp.openById(WORKBOOKS.long);
  let sheet = ss.getSheetByName(STATE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STATE_SHEET_NAME);
    try { sheet.hideSheet(); } catch (e) {}
  }
  return sheet;
}

function clearPropertyState_() {
  const props = PropertiesService.getScriptProperties();
  const oldCount = Number(props.getProperty(STATE_PREFIX + 'count') || 0);
  for (let i = 0; i < oldCount; i++) props.deleteProperty(STATE_PREFIX + i);
  props.deleteProperty(STATE_PREFIX + 'count');
}

function loadAppStateFromProperties_() {
  const props = PropertiesService.getScriptProperties();
  const count = Number(props.getProperty(STATE_PREFIX + 'count') || 0);
  if (!count) return null;
  let json = '';
  for (let i = 0; i < count; i++) json += props.getProperty(STATE_PREFIX + i) || '';
  if (!json) return null;
  return JSON.parse(json);
}

function loadAppStateFromDrive_() {
  if (!STATE_DRIVE_FILE_ID) return null;
  try {
    const file = DriveApp.getFileById(STATE_DRIVE_FILE_ID);
    const json = file.getBlob().getDataAsString();
    if (!json) return null;
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function loadAppStateFromSheet_() {
  try {
    const sheet = getStateSheet_();
    const last = sheet.getLastRow();
    if (last < 2) return null;
    const vals = sheet.getRange(2, 2, last, 2).getValues();
    let json = '';
    for (let i = 0; i < vals.length; i++) json += vals[i][0] || '';
    if (!json) return null;
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function loadAppState_() {
  // Prefer Drive when configured: filled offline JSON is authoritative and avoids
  // partial/corrupt sheet writes. Fall back to sheet, then legacy properties.
  const fromDrive = loadAppStateFromDrive_();
  if (fromDrive) {
    try { clearPropertyState_(); } catch (eClear) {}
    return fromDrive;
  }
  const fromSheet = loadAppStateFromSheet_();
  if (fromSheet) {
    try { clearPropertyState_(); } catch (eClear2) {}
    return fromSheet;
  }
  const legacy = loadAppStateFromProperties_();
  if (legacy) {
    try { saveAppState_(legacy); } catch (e2) {}
    return legacy;
  }
  return null;
}

function saveAppState_(state) {
  const json = JSON.stringify(state);
  // Prefer Drive file when configured (handles >500KB state).
  if (STATE_DRIVE_FILE_ID) {
    try {
      DriveApp.getFileById(STATE_DRIVE_FILE_ID).setContent(json);
      try { clearPropertyState_(); } catch (e) {}
      return;
    } catch (eDrive) {
      // fall through to sheet
    }
  }
  const sheet = getStateSheet_();
  const chunks = [];
  for (let i = 0; i < json.length; i += STATE_CELL_CHUNK) {
    chunks.push([Math.floor(i / STATE_CELL_CHUNK), json.slice(i, i + STATE_CELL_CHUNK)]);
  }
  sheet.clear();
  sheet.getRange(1, 1, 1, 2).setValues([['chunk', 'json']]);
  if (chunks.length) sheet.getRange(2, 1, 1 + chunks.length, 2).setValues(chunks);
  try { clearPropertyState_(); } catch (e) {}
}

function publicState_(state) {
  const out = JSON.parse(JSON.stringify(state));
  ['experiments','sprint','research','competitors','assumptions','barriers','milestones','expenses','findings','investmentExperiments'].forEach(function(k) {
    out[k] = (out[k] || []).filter(function(r) { return !r.deletedAt; });
  });
  out.conflicts = out.conflicts || [];
  out.sheetRows = out.sheetRows || {};
  out.sync = Object.assign({}, out.sync || {}, {
    configured: true,
    health: out.sync && out.sync.lastError ? 'error' : 'synced',
    openConflicts: (out.conflicts || []).length,
    editorUrl: 'https://script.google.com/d/1V40wOjW0D5BJ5SrpStBrOdJRpFAMP2nxod5oNhy8KJ0JK3l9mbYM4Ruo/edit',
    sheets: Object.assign({}, currentSyncSheets_(), (out.sync && out.sync.sheets) || {})
  });
  return out;
}

function mutateState_(state, m) {
  const now = new Date().toISOString();
  if (m.op === 'saveFinancials') {
    const item = Object.assign({}, m.model || {}, { ideaId: m.ideaId, updatedAt: now });
    const idx = (state.financials || []).findIndex(function(x) { return x.ideaId === m.ideaId; });
    if (idx >= 0) state.financials[idx] = item; else (state.financials || (state.financials = [])).push(item);
    return { id: m.ideaId };
  }
  if (m.op === 'setGuardrail') {
    (state.guardrails || (state.guardrails = {}))[m.key] = m.value;
    writeGuardrails_({ values: state.guardrails });
    return { id: m.key };
  }
  if (m.op === 'resolveConflict') return { id: m.id };
  const list = state[m.collection];
  if (!Array.isArray(list)) throw new Error('Unknown collection: ' + m.collection);
  if (m.op === 'create') {
    const id = Utilities.getUuid();
    const record = Object.assign(defaultRecord_(m.collection), cleanStateInput_(m.data || {}), { id: id, syncId: Utilities.getUuid(), source: 'site', createdAt: now, updatedAt: now, deletedAt: null });
    list.push(record);
    addHistory_(state, record.ideaId || (m.collection === 'ideas' ? id : null), m.collection, id, 'created', 'Created on the site');
    return { id: id };
  }
  const record = list.find(function(x) { return x.id === m.id; });
  if (!record) throw new Error('That record no longer exists.');
  if (m.op === 'update') Object.assign(record, cleanStateInput_(m.data || {}), { updatedAt: now });
  else if (m.op === 'delete') Object.assign(record, { deletedAt: now, updatedAt: now });
  else if (m.op === 'restore') Object.assign(record, { deletedAt: null, updatedAt: now });
  else throw new Error('Unknown operation: ' + m.op);
  return { id: record.id };
}

function cleanStateInput_(data) {
  const out = {};
  Object.keys(data || {}).forEach(function(k) { if (PROTECTED_STATE_FIELDS.indexOf(k) === -1) out[k] = data[k] === '' ? null : data[k]; });
  return out;
}

function defaultRecord_(collection) {
  const defaults = {
    ideas: { title:'',description:'',horizon:'Short Term',incomeStyle:'Active',opportunityType:'Other',category:'',status:'Exploring',stage:'Discover',ventureTrack:null,details:{} },
    experiments: { ideaId:null,ideaLabel:'',name:'',status:'Planned' }, sprint: { ideaId:null,day:'',status:'',action:'',deliverable:'' },
    research: { ideaId:null,kind:'Note',area:'General',title:'',content:'',tags:[] }, competitors: { ideaId:null,name:'Untitled competitor' },
    assumptions: { ideaId:null,assumption:'New assumption',status:'Unknown' }, barriers: { ideaId:null,type:'capital' },
    milestones: { ideaId:null,ideaLabel:'',title:'',stage:'Discover',status:'Not Started' }, expenses: { ideaId:null,ideaLabel:'',category:'',item:'' },
    findings: { ideaId:null,title:'Untitled finding',scope:'Global' }, investments: { name:'',status:'Learn',accountOrAsset:'Asset',passiveLevel:'Low ongoing involvement',riskProfile:{} },
    investmentExperiments: { investmentId:null,investmentLabel:'',name:'',mode:'Paper',status:'Planned' }
  };
  return Object.assign({}, defaults[collection] || {});
}

function addHistory_(state, ideaId, entityType, entityId, kind, summary) {
  (state.history || (state.history = [])).unshift({ id: Utilities.getUuid(), ideaId: ideaId || null, entityType: entityType, entityId: entityId, kind: kind, summary: summary, at: new Date().toISOString() });
  state.history = state.history.slice(0, 400);
}

function tabsForRecord_(collection, record) {
  if (collection !== 'ideas') return COLLECTION_TABS[collection] || [];
  if (record.horizon === 'Both') return ['shortIdeas','longIdeas'];
  return record.horizon === 'Long Term' ? ['longIdeas'] : ['shortIdeas'];
}

function recordValues_(key, record) {
  const values = {};
  mapFields_(key).forEach(function(f) {
    let value = record[f.field];
    if (f.field.indexOf('risk') === 0 && f.app) {
      const names = { riskMarket:'market',riskPrincipal:'principal',riskCredit:'credit',riskInterestRate:'interestRate',riskInflation:'inflation',riskComplexity:'complexity' };
      value = record.riskProfile && record.riskProfile[names[f.field]] && record.riskProfile[names[f.field]].level;
    }
    if (f.field === 'incomeStyle' && value === 'Passive-ish') value = 'Passive';
    values[f.header] = value === undefined || value === null ? '' : value;
  });
  return values;
}

function syncMutationToSheets_(state, m, id) {
  if (!m.collection || !COLLECTION_TABS[m.collection]) return;
  const record = (state[m.collection] || []).find(function(r) { return r.id === id; });
  if (!record || !record.syncId) return;
  // Venture Studio and Idea Vault records intentionally live in the site only;
  // they are not income-discovery rows and must not be forced into either workbook.
  if (m.collection === 'ideas' && record.ventureTrack) return;
  const allTabs = COLLECTION_TABS[m.collection];
  const desired = tabsForRecord_(m.collection, record);
  const ops = [];
  allTabs.forEach(function(key) {
    if (desired.indexOf(key) >= 0 && !record.deletedAt) ops.push({ tab:key, syncId:record.syncId, op:'upsert', values:recordValues_(key, record), restore:m.op === 'restore' });
    else ops.push({ tab:key, syncId:record.syncId, op:'markDeleted', reason:'site' });
  });
  writeOps_(ops);
}

function parseStateCell_(value, type) {
  if (value === '' || value === null || value === undefined) return null;
  if (type === 'n') { const n = Number(value); return isFinite(n) ? n : null; }
  if (type === 'd') return String(value).slice(0, 10);
  return String(value);
}

function reconcileState_(state, selectedTabs) {
  const keys = Array.isArray(selectedTabs) && selectedTabs.length ? selectedTabs : Object.keys(STATE_TAB_MAPS);
  let fromSheet = 0, toSheet = 0;
  const selected = {};
  keys.forEach(function(key) { selected[key] = true; });
  if (keys.length === Object.keys(STATE_TAB_MAPS).length) {
    state.sheetRows = {};
  } else {
    // A focused sync must not discard links belonging to the other workbook tabs.
    const existing = state.sheetRows || {};
    Object.keys(existing).forEach(function(syncId) {
      existing[syncId] = (existing[syncId] || []).filter(function(ref) { return !selected[ref.tab]; });
      if (!existing[syncId].length) delete existing[syncId];
    });
    state.sheetRows = existing;
  }
  keys.forEach(function(key) {
    if (!STATE_TAB_MAPS[key]) return;
    const pulled = pullTab_(key);
    if (!pulled.found) return;
    const collection = TAB_COLLECTION[key];
    const list = state[collection] || (state[collection] = []);
    const fields = mapFields_(key);
    pulled.rows.forEach(function(row) {
      let record = list.find(function(r) { return r.syncId === row.syncId; });
      if (!record) {
        record = Object.assign(defaultRecord_(collection), { id:Utilities.getUuid(),syncId:row.syncId,source:'sheet',createdAt:new Date().toISOString(),updatedAt:row.updatedAt || new Date().toISOString(),deletedAt:null });
        if (collection === 'ideas') record.horizon = key === 'longIdeas' ? 'Long Term' : 'Short Term';
        list.push(record);
      }
      if (row.deleted) record.deletedAt = record.deletedAt || new Date().toISOString();
      else {
        record.deletedAt = null;
        fields.forEach(function(f) {
          if (f.app || !Object.prototype.hasOwnProperty.call(row.values, f.header)) return;
          let value = parseStateCell_(row.values[f.header], f.type);
          if (f.field === 'incomeStyle' && value === 'Passive') value = 'Passive-ish';
          record[f.field] = value;
        });
      }
      record.updatedAt = row.updatedAt || record.updatedAt;
      (state.sheetRows[row.syncId] || (state.sheetRows[row.syncId] = [])).push({ tab:key,row:row.row });
      fromSheet++;
    });
    // Site edits are written to Sheets immediately by syncMutationToSheets_. A
    // periodic reconcile only pulls user-authoritative columns, keeping startup
    // fast and never rewriting external/app-owned facts from a Sheet value.
  });
  const g = pullGuardrails_();
  if (g.found) state.guardrails = Object.assign({}, state.guardrails || {}, g.values || {});
  const syncedAt = new Date().toISOString();
  state.sync = Object.assign({}, state.sync || {}, { configured:true,health:'synced',lastRunAt:syncedAt,lastSuccessAt:syncedAt,lastError:null,openConflicts:0,sheets:currentSyncSheets_() });
  return { ok:true,fromSheet:fromSheet,toSheet:toSheet };
}
