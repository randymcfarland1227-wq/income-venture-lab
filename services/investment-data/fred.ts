import { closestBefore, fetchText, pct } from "./http";
import type { InvestmentDataProvider, ProviderResult } from "./types";

const URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500";

export class FredSp500Provider implements InvestmentDataProvider {
  readonly name = "fred-sp500";
  readonly sourceUrl = "https://fred.stlouisfed.org/series/SP500";
  readonly staleAfterMinutes = 720;

  async fetch(): Promise<ProviderResult> {
    const start = new Date();
    start.setUTCFullYear(start.getUTCFullYear() - 6);
    const csv = await fetchText(`${URL}&cosd=${start.toISOString().slice(0, 10)}`, {}, 20_000);
    const rows = csv.trim().split(/\r?\n/).slice(1).map(line => {
      const [date, raw] = line.split(",");
      return { date, value: Number(raw) };
    }).filter(row => row.date && Number.isFinite(row.value));
    if (rows.length < 2) throw new Error("FRED returned too few S&P 500 observations.");
    const latest = rows[rows.length - 1];
    const prior = rows[rows.length - 2];
    const latestDate = new Date(`${latest.date}T00:00:00Z`);
    const priorYearEnd = closestBefore(rows, new Date(Date.UTC(latestDate.getUTCFullYear() - 1, 11, 31)));
    const oneYearDate = new Date(latestDate); oneYearDate.setUTCFullYear(oneYearDate.getUTCFullYear() - 1);
    const fiveYearDate = new Date(latestDate); fiveYearDate.setUTCFullYear(fiveYearDate.getUTCFullYear() - 5);
    const oneYear = closestBefore(rows, oneYearDate);
    const fiveYear = closestBefore(rows, fiveYearDate);
    const fetchedAt = new Date().toISOString();
    const base = {
      investmentId: "inv-sp500-benchmark", unit: "index points", observationDate: latest.date, fetchedAt,
      provider: this.name, sourceName: "FRED / S&P Dow Jones Indices LLC", sourceUrl: this.sourceUrl,
      methodology: "S&P 500 daily closing price index. Returns are price returns and exclude dividends.", isDelayed: true, isStale: false,
    };
    const values = [
      ["level", latest.value], ["daily_pct", pct(latest.value, prior.value)], ["ytd_pct", pct(latest.value, priorYearEnd)],
      ["one_year_pct", pct(latest.value, oneYear)],
      ["five_year_annualized_pct", fiveYear ? (Math.pow(latest.value / fiveYear, 1 / 5) - 1) * 100 : null],
    ] as const;
    const metrics = values.flatMap(([metric, value]) => value === null ? [] : [{
      ...base,
      metric,
      value,
      unit: metric === "level" ? "index points" : "percent",
    }]);
    return { provider: this.name, sourceUrl: this.sourceUrl, staleAfterMinutes: this.staleAfterMinutes, metrics };
  }
}
