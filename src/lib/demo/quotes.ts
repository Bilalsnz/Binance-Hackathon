import type { Source } from "@/lib/engine/types";

/** A single market quote as the agent "sees" it while researching. */
export interface Quote {
  symbol: string; // "BTC"
  pair: string; // "BTCUSDT"
  priceUsd: number;
  changePct24h: number;
  updatedAt: string;
  /** `live` = fetched from Binance's public API; `fallback` = demo quotes. */
  source: "live" | "fallback";
}

export type QuoteMap = Record<string, Quote>;

/**
 * Realistic cached quotes used when the live Binance public API is not
 * reachable (region block, offline venue, Vercel cold start). The UI always
 * labels these as simulated demo quotes — they are never presented as live.
 */
export const FALLBACK_QUOTES: QuoteMap = {
  BTC: {
    symbol: "BTC",
    pair: "BTCUSDT",
    priceUsd: 84523,
    changePct24h: 2.35,
    updatedAt: "2026-09-01T09:15:00.000Z",
    source: "fallback",
  },
  ETH: {
    symbol: "ETH",
    pair: "ETHUSDT",
    priceUsd: 3142,
    changePct24h: 1.82,
    updatedAt: "2026-09-01T09:15:00.000Z",
    source: "fallback",
  },
};

/** Human label for a quote source shown next to research cards. */
export function quoteSourceLabel(source: Source | Quote["source"]): string {
  return source === "live" ? "Binance public data" : "Demo quote (simulated)";
}

export function quoteToUsd(quote: Quote): string {
  if (quote.priceUsd >= 1000) {
    return quote.priceUsd.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return quote.priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
