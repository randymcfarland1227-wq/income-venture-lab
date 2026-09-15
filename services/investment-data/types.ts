export type NormalizedMetric = {
  investmentId: string;
  metric: string;
  value: number;
  unit: string;
  observationDate: string;
  fetchedAt: string;
  provider: string;
  sourceName: string;
  sourceUrl: string;
  methodology: string;
  isDelayed: boolean;
  isStale: boolean;
};

export type NormalizedRule = {
  investmentId: string;
  ruleKey: string;
  ruleYear: number;
  value: string;
  unit: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  observationDate: string;
  fetchedAt: string;
};

export type ProviderResult = { provider: string; sourceUrl: string; staleAfterMinutes: number; metrics?: NormalizedMetric[]; rules?: NormalizedRule[] };

export interface InvestmentDataProvider {
  readonly name: string;
  readonly sourceUrl: string;
  readonly staleAfterMinutes: number;
  fetch(): Promise<ProviderResult>;
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<NormalizedMetric>;
  getHistoricalPrices(symbol: string, start: string, end: string): Promise<NormalizedMetric[]>;
  searchSymbols(query: string): Promise<Array<{ symbol: string; name: string }>>;
  getFundMetadata(symbol: string): Promise<Record<string, unknown>>;
}
