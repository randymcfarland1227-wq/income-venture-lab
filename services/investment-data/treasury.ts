import { fetchText } from "./http";
import type { InvestmentDataProvider, ProviderResult } from "./types";

export class TreasuryYieldProvider implements InvestmentDataProvider {
  readonly name = "us-treasury-yield-curve";
  readonly sourceUrl = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve";
  readonly staleAfterMinutes = 1440;

  async fetch(): Promise<ProviderResult> {
    const year = new Date().getUTCFullYear();
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
    const xml = await fetchText(url);
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    if (!entries.length) throw new Error("Treasury returned no yield-curve observations.");
    const last = entries[entries.length - 1];
    const read = (tag: string) => last.match(new RegExp(`<d:${tag}[^>]*>([^<]+)<\\/d:${tag}>`, "i"))?.[1];
    const dateRaw = read("NEW_DATE");
    if (!dateRaw) throw new Error("Treasury observation date was unavailable.");
    const observationDate = dateRaw.slice(0, 10);
    const fetchedAt = new Date().toISOString();
    const tenors = [
      ["3_month_yield", "BC_3MONTH", "inv-tbill"], ["1_year_yield", "BC_1YEAR", "inv-tbill"],
      ["2_year_yield", "BC_2YEAR", "inv-tnote"], ["10_year_yield", "BC_10YEAR", "inv-tnote"],
      ["30_year_yield", "BC_30YEAR", "inv-tbond"],
    ] as const;
    const metrics = tenors.flatMap(([metric, tag, investmentId]) => {
      const value = Number(read(tag));
      return Number.isFinite(value) ? [{ investmentId, metric, value, unit: "percent", observationDate, fetchedAt,
        provider: this.name, sourceName: "U.S. Department of the Treasury", sourceUrl: this.sourceUrl,
        methodology: "Daily Treasury par yield curve rate.", isDelayed: true, isStale: false }] : [];
    });
    if (!metrics.length) throw new Error("Treasury yield fields were unavailable.");
    return { provider: this.name, sourceUrl: this.sourceUrl, staleAfterMinutes: this.staleAfterMinutes, metrics };
  }
}
