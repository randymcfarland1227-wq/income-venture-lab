import { fetchText } from "./http";
import type { InvestmentDataProvider, ProviderResult } from "./types";

export class BlsCpiProvider implements InvestmentDataProvider {
  readonly name = "bls-cpi";
  readonly sourceUrl = "https://www.bls.gov/cpi/";
  readonly staleAfterMinutes = 10080;

  async fetch(): Promise<ProviderResult> {
    const year = new Date().getUTCFullYear();
    const text = await fetchText("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ seriesid: ["CUUR0000SA0"], startyear: String(year - 2), endyear: String(year) }),
    });
    const data = JSON.parse(text) as { status: string; Results?: { series?: Array<{ data: Array<{ year: string; period: string; value: string }> }> } };
    const rows = data.Results?.series?.[0]?.data.filter(row => /^M\d\d$/.test(row.period)) ?? [];
    if (rows.length < 13) throw new Error("BLS returned too few CPI observations.");
    const ordered = [...rows].sort((a, b) => `${a.year}${a.period}`.localeCompare(`${b.year}${b.period}`));
    const latest = ordered[ordered.length - 1];
    const prior = ordered[ordered.length - 13];
    const value = ((Number(latest.value) / Number(prior.value)) - 1) * 100;
    if (!Number.isFinite(value)) throw new Error("BLS CPI calculation was unavailable.");
    const month = Number(latest.period.slice(1));
    const observationDate = `${latest.year}-${String(month).padStart(2, "0")}-01`;
    return { provider: this.name, sourceUrl: this.sourceUrl, staleAfterMinutes: this.staleAfterMinutes, metrics: [{
      investmentId: "context-inflation", metric: "cpi_12_month_change", value, unit: "percent", observationDate,
      fetchedAt: new Date().toISOString(), provider: this.name, sourceName: "U.S. Bureau of Labor Statistics",
      sourceUrl: this.sourceUrl, methodology: "12-month percent change in CPI-U, U.S. city average, all items, not seasonally adjusted (CUUR0000SA0).",
      isDelayed: true, isStale: false,
    }] };
  }
}
