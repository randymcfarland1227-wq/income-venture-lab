import { env } from "cloudflare:workers";
import type { MarketDataProvider, NormalizedMetric } from "./types";

export function configuredMarketDataProvider(): MarketDataProvider | null {
  const baseUrl = env.MARKET_DATA_API_URL ?? "";
  const apiKey = env.MARKET_DATA_API_KEY ?? "";
  if (!baseUrl || !apiKey) return null;
  // V1 deliberately leaves vendor-specific parsing behind this boundary. A licensed
  // provider adapter can be added without exposing its key or changing the UI.
  void baseUrl; void apiKey;
  return null;
}

export const marketProviderStatus = () => configuredMarketDataProvider()
  ? "configured" : "Live quote provider not configured";

export type { MarketDataProvider, NormalizedMetric };
