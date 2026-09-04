import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market";

/**
 * Live market snapshot for the research feed.
 *
 * This is the only live Binance call AgentGuard makes, and it is public and
 * keyless (the same `/api/v3/ticker/24hr` surface any agent can query).
 * When the request fails or is region-blocked it returns clearly-labelled
 * demo quotes — never fabricated "live" numbers.
 */
export async function GET() {
  const snapshot = await getMarketSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "cache-control": "no-store" },
  });
}
