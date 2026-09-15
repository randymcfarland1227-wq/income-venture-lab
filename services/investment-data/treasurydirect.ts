import { fetchText } from "./http";
import type { InvestmentDataProvider, NormalizedMetric, ProviderResult } from "./types";

function plain(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

export class TreasuryDirectSavingsBondProvider implements InvestmentDataProvider {
  readonly name = "treasurydirect-savings-bonds";
  readonly sourceUrl = "https://www.treasurydirect.gov/savings-bonds/";
  readonly staleAfterMinutes = 10080;

  async fetch(): Promise<ProviderResult> {
    const iUrl = "https://www.treasurydirect.gov/savings-bonds/i-bonds/i-bonds-interest-rates/";
    const eeUrl = "https://www.treasurydirect.gov/savings-bonds/ee-bonds/";
    const [iText, eeText] = await Promise.all([fetchText(iUrl, {}, 20_000), fetchText(eeUrl, {}, 20_000)]).then(values => values.map(plain));
    const parse = (text: string) => {
      const match = text.match(/Current Interest Rate[\s\S]{0,220}?(\d+(?:\.\d+)?)%[\s\S]{0,220}?issued\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+to\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
      if (!match) throw new Error("TreasuryDirect current-rate block was unavailable.");
      return { value: Number(match[1]), period: `${match[2]} to ${match[3]}`, date: new Date(match[2]).toISOString().slice(0, 10) };
    };
    const i = parse(iText); const ee = parse(eeText); const fetchedAt = new Date().toISOString();
    const make = (investmentId: string, metric: string, item: typeof i, url: string): NormalizedMetric => ({
      investmentId, metric, value: item.value, unit: "percent", observationDate: item.date, fetchedAt,
      provider: this.name, sourceName: "TreasuryDirect", sourceUrl: url,
      methodology: `Current issue rate for bonds issued ${item.period}.`, isDelayed: false, isStale: false,
    });
    return { provider: this.name, sourceUrl: this.sourceUrl, staleAfterMinutes: this.staleAfterMinutes,
      metrics: [make("inv-ibond", "i_bond_composite_rate", i, iUrl), make("inv-eebond", "ee_bond_rate", ee, eeUrl)] };
  }
}
