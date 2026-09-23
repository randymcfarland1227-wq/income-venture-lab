#!/usr/bin/env node
/**
 * Refresh official free market observations into public/market-data.json
 * for GitHub Pages (no server-side providers available there).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "market-data.json");
const UA = "IncomeVentureLab/1.0 educational research";

async function fetchText(url, init = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "user-agent": UA, ...(init.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const pct = (latest, base) => (base && Number.isFinite(base) ? ((latest / base) - 1) * 100 : null);

function closestBefore(rows, target) {
  const stamp = target.toISOString().slice(0, 10);
  return [...rows].reverse().find((row) => row.date <= stamp)?.value;
}

function metricId(provider, investmentId, metric, observationDate) {
  return `${provider}:${investmentId}:${metric}:${observationDate}`;
}

function withIds(metrics) {
  return metrics.map((m) => ({
    id: metricId(m.provider, m.investmentId, m.metric, m.observationDate),
    ...m,
  }));
}

async function fetchFredSp500() {
  const sourceUrl = "https://fred.stlouisfed.org/series/SP500";
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - 6);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500&cosd=${start.toISOString().slice(0, 10)}`;
  const csv = await fetchText(url);
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, raw] = line.split(",");
      return { date, value: Number(raw) };
    })
    .filter((row) => row.date && Number.isFinite(row.value));
  if (rows.length < 2) throw new Error("FRED returned too few S&P 500 observations.");
  const latest = rows[rows.length - 1];
  const prior = rows[rows.length - 2];
  const latestDate = new Date(`${latest.date}T00:00:00Z`);
  const priorYearEnd = closestBefore(rows, new Date(Date.UTC(latestDate.getUTCFullYear() - 1, 11, 31)));
  const oneYearDate = new Date(latestDate);
  oneYearDate.setUTCFullYear(oneYearDate.getUTCFullYear() - 1);
  const fiveYearDate = new Date(latestDate);
  fiveYearDate.setUTCFullYear(fiveYearDate.getUTCFullYear() - 5);
  const oneYear = closestBefore(rows, oneYearDate);
  const fiveYear = closestBefore(rows, fiveYearDate);
  const fetchedAt = new Date().toISOString();
  const provider = "fred-sp500";
  const base = {
    investmentId: "inv-sp500-benchmark",
    observationDate: latest.date,
    fetchedAt,
    provider,
    sourceName: "FRED / S&P Dow Jones Indices LLC",
    sourceUrl,
    methodology: "S&P 500 daily closing price index. Returns are price returns and exclude dividends.",
    isDelayed: true,
    isStale: false,
  };
  const values = [
    ["level", latest.value],
    ["daily_pct", pct(latest.value, prior.value)],
    ["ytd_pct", pct(latest.value, priorYearEnd)],
    ["one_year_pct", pct(latest.value, oneYear)],
    [
      "five_year_annualized_pct",
      fiveYear ? (Math.pow(latest.value / fiveYear, 1 / 5) - 1) * 100 : null,
    ],
  ];
  const metrics = values.flatMap(([metric, value]) =>
    value === null
      ? []
      : [
          {
            ...base,
            metric,
            value,
            unit: metric === "level" ? "index points" : "percent",
          },
        ],
  );
  return {
    provider,
    sourceUrl,
    staleAfterMinutes: 720,
    status: "ok",
    metrics: withIds(metrics),
  };
}

async function fetchTreasuryYields() {
  const sourceUrl =
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve";
  const year = new Date().getUTCFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
  const xml = await fetchText(url);
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  if (!entries.length) throw new Error("Treasury returned no yield-curve observations.");
  const last = entries[entries.length - 1];
  const read = (tag) => last.match(new RegExp(`<d:${tag}[^>]*>([^<]+)<\\/d:${tag}>`, "i"))?.[1];
  const dateRaw = read("NEW_DATE");
  if (!dateRaw) throw new Error("Treasury observation date was unavailable.");
  const observationDate = dateRaw.slice(0, 10);
  const fetchedAt = new Date().toISOString();
  const provider = "us-treasury-yield-curve";
  const tenors = [
    ["3_month_yield", "BC_3MONTH", "inv-tbill"],
    ["1_year_yield", "BC_1YEAR", "inv-tbill"],
    ["2_year_yield", "BC_2YEAR", "inv-tnote"],
    ["10_year_yield", "BC_10YEAR", "inv-tnote"],
    ["30_year_yield", "BC_30YEAR", "inv-tbond"],
  ];
  const metrics = tenors.flatMap(([metric, tag, investmentId]) => {
    const value = Number(read(tag));
    return Number.isFinite(value)
      ? [
          {
            investmentId,
            metric,
            value,
            unit: "percent",
            observationDate,
            fetchedAt,
            provider,
            sourceName: "U.S. Department of the Treasury",
            sourceUrl,
            methodology: "Daily Treasury par yield curve rate.",
            isDelayed: true,
            isStale: false,
          },
        ]
      : [];
  });
  if (!metrics.length) throw new Error("Treasury yield fields were unavailable.");
  return {
    provider,
    sourceUrl,
    staleAfterMinutes: 1440,
    status: "ok",
    metrics: withIds(metrics),
  };
}

function plain(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function fetchTreasuryDirectBonds() {
  const sourceUrl = "https://www.treasurydirect.gov/savings-bonds/";
  const iUrl = "https://www.treasurydirect.gov/savings-bonds/i-bonds/i-bonds-interest-rates/";
  const eeUrl = "https://www.treasurydirect.gov/savings-bonds/ee-bonds/";
  const [iHtml, eeHtml] = await Promise.all([fetchText(iUrl), fetchText(eeUrl)]);
  const iText = plain(iHtml);
  const eeText = plain(eeHtml);
  const parse = (text) => {
    const match = text.match(
      /Current Interest Rate[\s\S]{0,220}?(\d+(?:\.\d+)?)%[\s\S]{0,220}?issued\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+to\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i,
    );
    if (!match) throw new Error("TreasuryDirect current-rate block was unavailable.");
    return {
      value: Number(match[1]),
      period: `${match[2]} to ${match[3]}`,
      date: new Date(match[2]).toISOString().slice(0, 10),
    };
  };
  const i = parse(iText);
  const ee = parse(eeText);
  const fetchedAt = new Date().toISOString();
  const provider = "treasurydirect-savings-bonds";
  const make = (investmentId, metric, item, url) => ({
    investmentId,
    metric,
    value: item.value,
    unit: "percent",
    observationDate: item.date,
    fetchedAt,
    provider,
    sourceName: "TreasuryDirect",
    sourceUrl: url,
    methodology: `Current issue rate for bonds issued ${item.period}.`,
    isDelayed: false,
    isStale: false,
  });
  return {
    provider,
    sourceUrl,
    staleAfterMinutes: 10080,
    status: "ok",
    metrics: withIds([
      make("inv-ibond", "i_bond_composite_rate", i, iUrl),
      make("inv-eebond", "ee_bond_rate", ee, eeUrl),
    ]),
  };
}

async function fetchBlsCpi() {
  const sourceUrl = "https://www.bls.gov/cpi/";
  const year = new Date().getUTCFullYear();
  // Unauthenticated public BLS API (strict daily quota). No invented numbers if it fails.
  const text = await fetchText("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seriesid: ["CUUR0000SA0"],
      startyear: String(year - 2),
      endyear: String(year),
    }),
  });
  const data = JSON.parse(text);
  if (data.status !== "REQUEST_SUCCEEDED") {
    throw new Error(data.message?.join?.("; ") || data.status || "BLS request failed (API key may be required).");
  }
  const rows = data.Results?.series?.[0]?.data?.filter((row) => /^M\d\d$/.test(row.period)) ?? [];
  if (rows.length < 13) throw new Error("BLS returned too few CPI observations.");
  const ordered = [...rows].sort((a, b) => `${a.year}${a.period}`.localeCompare(`${b.year}${b.period}`));
  const latest = ordered[ordered.length - 1];
  const prior = ordered[ordered.length - 13];
  const value = (Number(latest.value) / Number(prior.value) - 1) * 100;
  if (!Number.isFinite(value)) throw new Error("BLS CPI calculation was unavailable.");
  const month = Number(latest.period.slice(1));
  const observationDate = `${latest.year}-${String(month).padStart(2, "0")}-01`;
  const provider = "bls-cpi";
  return {
    provider,
    sourceUrl,
    staleAfterMinutes: 10080,
    status: "ok",
    metrics: withIds([
      {
        investmentId: "context-inflation",
        metric: "cpi_12_month_change",
        value,
        unit: "percent",
        observationDate,
        fetchedAt: new Date().toISOString(),
        provider,
        sourceName: "U.S. Bureau of Labor Statistics",
        sourceUrl,
        methodology:
          "12-month percent change in CPI-U, U.S. city average, all items, not seasonally adjusted (CUUR0000SA0).",
        isDelayed: true,
        isStale: false,
      },
    ]),
  };
}

async function runProvider(name, fn) {
  const attemptedAt = new Date().toISOString();
  try {
    const result = await fn();
    return {
      ...result,
      refresh: { provider: name, status: "ok" },
      sourceRecord: {
        provider: name,
        status: "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: attemptedAt,
        lastError: null,
        staleAfterMinutes: result.staleAfterMinutes,
        sourceUrl: result.sourceUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${name}] ${message}`);
    return {
      provider: name,
      metrics: [],
      refresh: { provider: name, status: "error", error: message },
      sourceRecord: {
        provider: name,
        status: "error",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: null,
        lastError: message,
        staleAfterMinutes: 1440,
        sourceUrl: "",
      },
    };
  }
}

async function main() {
  const providers = await Promise.all([
    runProvider("fred-sp500", fetchFredSp500),
    runProvider("us-treasury-yield-curve", fetchTreasuryYields),
    runProvider("treasurydirect-savings-bonds", fetchTreasuryDirectBonds),
    runProvider("bls-cpi", fetchBlsCpi),
  ]);

  const metrics = providers.flatMap((p) => p.metrics ?? []);
  const sources = providers.map((p) => p.sourceRecord);
  const results = providers.map((p) => p.refresh);

  const payload = {
    metrics,
    sources,
    rules: [],
    marketQuoteProvider:
      "Official public sources refreshed via GitHub Action; licensed security quotes not configured.",
    refresh: { results, marketQuoteProvider: "Official public sources refreshed via GitHub Action; licensed security quotes not configured." },
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const ok = results.filter((r) => r.status === "ok").map((r) => r.provider);
  const failed = results.filter((r) => r.status === "error");
  console.log(`Wrote ${metrics.length} metrics to ${OUT}`);
  console.log(`OK: ${ok.join(", ") || "(none)"}`);
  if (failed.length) {
    console.log(`Failed: ${failed.map((f) => `${f.provider} (${f.error})`).join("; ")}`);
  }

  const hasSp = metrics.some((m) => m.investmentId === "inv-sp500-benchmark" && m.metric === "level");
  const yieldCount = metrics.filter((m) => /_yield$/.test(m.metric)).length;
  if (!hasSp || yieldCount < 1) {
    console.error("Validation failed: need S&P level and at least one Treasury yield.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
