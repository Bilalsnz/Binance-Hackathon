import { FALLBACK_QUOTES, type Quote, type QuoteMap } from "@/lib/demo/quotes";

/**
 * Fetch a small market snapshot for the demo's research feed.
 *
 * Research data is the *only* live Binance call AgentGuard makes and it is
 * public and keyless — the exact surface Binance documents for agents
 * (`GET /api/v3/ticker/24hr`). Quotes are verified for the assets the policy
 * cares about. If the call fails (offline venue, region block, cold start)
 * the caller falls back to clearly-labelled demo quotes.
 */

const SYMBOLS = ["BTC", "ETH"];
const DEFAULT_BASE = "https://api.binance.com";
const REQUEST_TIMEOUT_MS = 4500;

export interface MarketResult {
  quotes: QuoteMap;
  /** `live` when at least one quote came from the Binance public API. */
  source: "live" | "fallback";
  updatedAt: string;
}

interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

async function fetchTicker(baseUrl: string, base: string): Promise<Quote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(
      base + "USDT"
    )}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Ticker24h;
    const price = Number(data.lastPrice);
    const change = Number(data.priceChangePercent);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      symbol: base,
      pair: data.symbol,
      priceUsd: price,
      changePct24h: Number.isFinite(change) ? change : 0,
      updatedAt: new Date().toISOString(),
      source: "live",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort live snapshot. Never throws — returns fallback on failure. */
export async function getMarketSnapshot(): Promise<MarketResult> {
  const base = process.env.AGENTGUARD_MARKET_BASE_URL?.trim() || DEFAULT_BASE;
  const fetched = await Promise.all(SYMBOLS.map((s) => fetchTicker(base, s)));
  const live: QuoteMap = {};
  for (const q of fetched) if (q) live[q.symbol] = q;

  const anyLive = Object.keys(live).length > 0;
  // Live quotes win; anything that failed keeps its individually-labelled
  // fallback quote so no pair is ever silently presented as live.
  const merged: QuoteMap = { ...FALLBACK_QUOTES, ...live };

  return {
    quotes: merged,
    source: anyLive ? "live" : "fallback",
    updatedAt: new Date().toISOString(),
  };
}
