import { fetchText } from "./http";
import type { InvestmentDataProvider, NormalizedRule, ProviderResult } from "./types";

export class IrsRetirementRulesProvider implements InvestmentDataProvider {
  readonly name = "irs-retirement-rules";
  readonly sourceUrl = "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500";
  readonly staleAfterMinutes = 43200;

  async fetch(): Promise<ProviderResult> {
    const html = await fetchText(this.sourceUrl);
    const text = html.replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|#160);/g, " ").replace(/\s+/g, " ");
    const yearMatch = text.match(/for\s+(20\d{2})/i);
    const year = Number(yearMatch?.[1]);
    const plan = text.match(/(?:401\(k\)[\s\S]{0,180}?|contribute to their 401\(k\)[\s\S]{0,120}?)\$([\d,]+)/i);
    const ira = text.match(/(?:annual contribution limit to an IRA|IRA limit)[\s\S]{0,120}?\$([\d,]+)/i);
    if (!year || !plan || !ira) throw new Error("IRS contribution-limit values were unavailable.");
    const fetchedAt = new Date().toISOString();
    const make = (investmentId: string, ruleKey: string, value: string, summary: string): NormalizedRule => ({
      investmentId, ruleKey, ruleYear: year, value: value.replace(/,/g, ""), unit: "USD", summary,
      sourceName: "Internal Revenue Service", sourceUrl: this.sourceUrl, observationDate: `${year}-01-01`, fetchedAt,
    });
    const rules = [
      make("inv-401k", "employee_contribution_limit", plan[1], `${year} employee contribution limit`),
      make("inv-403b", "employee_contribution_limit", plan[1], `${year} employee contribution limit`),
      make("inv-solo-401k", "employee_contribution_limit", plan[1], `${year} employee contribution limit; other limits and rules may also apply`),
      make("inv-roth-ira", "ira_contribution_limit", ira[1], `${year} IRA contribution limit; eligibility and income rules apply`),
      make("inv-traditional-ira", "ira_contribution_limit", ira[1], `${year} IRA contribution limit; deduction rules may apply`),
    ];
    return { provider: this.name, sourceUrl: this.sourceUrl, staleAfterMinutes: this.staleAfterMinutes, rules };
  }
}
