/**
 * The scripted demo timeline.
 *
 * The demo agent follows this script, but every "action" step is run through
 * the *real* policy engine at runtime — nothing here pre-decides the verdict.
 * That is what makes the demo trustworthy: change the policy in the builder
 * and the same script produces different decisions.
 */

export type DemoScriptStep =
  | {
      type: "research";
      symbol: string;
      headline: string;
      note: string;
      tone: "bullish" | "neutral";
    }
  | {
      type: "action";
      goal: string;
      symbol: string;
      side: "buy" | "sell";
      market: "spot" | "futures";
      kind: "trade" | "withdraw";
      notionalUsd: number;
      estRiskUsd: number;
      reason: string;
      /** Delay before the agent proposes it (ms) so research reads first. */
      thinkMs?: number;
    };

/** Narrative between the proposal and the policy verdict. */
export const AGENT_NAME = "Nova";
export const AGENT_PERSONA =
  "A cautious trading agent connected through Binance Agent OS. It researches public market data, then proposes actions — which AgentGuard checks against your mandate before anything touches an exchange.";

export const DEMO_SCRIPT: DemoScriptStep[] = [
  {
    type: "research",
    symbol: "BTC",
    headline: "BTC holding a range near monthly support",
    note: "Price sits above the 50-period mean; 24h momentum is mildly positive. No material news spike — treating this as a stable accumulation window.",
    tone: "neutral",
  },
  {
    type: "action",
    goal: "Accumulate BTC inside the mandate",
    symbol: "BTC",
    side: "buy",
    market: "spot",
    kind: "trade",
    notionalUsd: 100,
    estRiskUsd: 12,
    reason:
      "Enter a starter BTC position sized to the $150 per-position cap with a stop-out loss estimate under the $20 risk limit.",
    thinkMs: 900,
  },
  {
    type: "action",
    goal: "Scale the BTC position up",
    symbol: "BTC",
    side: "buy",
    market: "spot",
    kind: "trade",
    notionalUsd: 250,
    // Stop-loss keeps worst case under the $20 loss cap — so the ONE reason
    // this is denied is the $150 position cap, not the risk rule.
    estRiskUsd: 15,
    reason:
      "Momentum looks strong — raise the position to $250 to capture more upside.",
    thinkMs: 650,
  },
  {
    type: "action",
    goal: "Add Solana for diversification",
    symbol: "SOL",
    side: "buy",
    market: "spot",
    kind: "trade",
    notionalUsd: 80,
    estRiskUsd: 15,
    reason:
      "SOL shows a breakout pattern; a small $80 starter position diversifies the book.",
    thinkMs: 650,
  },
  {
    type: "research",
    symbol: "BTC",
    headline: "BTC volatility picking up — futures leverage tempting",
    note: "Derivatives basis is widening. A leveraged BTC long would amplify the upside of the current setup.",
    tone: "bullish",
  },
  {
    type: "action",
    goal: "Leverage the BTC setup",
    symbol: "BTC",
    side: "buy",
    market: "futures",
    kind: "trade",
    notionalUsd: 100,
    estRiskUsd: 18,
    reason:
      "Open a USDⓈ-M futures long on BTC with a tight stop to ride the volatility.",
    thinkMs: 700,
  },
  {
    type: "action",
    goal: "Move profits out of the account",
    symbol: "USDT",
    side: "buy",
    market: "spot",
    kind: "withdraw",
    notionalUsd: 40,
    estRiskUsd: 0,
    reason:
      "Send $40 of the demo balance to an external wallet to bank the gains.",
    thinkMs: 700,
  },
  {
    type: "research",
    symbol: "ETH",
    headline: "ETH consolidating under resistance",
    note: "ETH is coiling below a tight resistance level with declining volume — a reasonable, calmer second allocation.",
    tone: "neutral",
  },
  {
    type: "action",
    goal: "Second allocation to ETH",
    symbol: "ETH",
    side: "buy",
    market: "spot",
    kind: "trade",
    notionalUsd: 60,
    estRiskUsd: 9,
    reason:
      "Add a modest ETH position after confirmation; keeps aggregate exposure inside the $500 capital ceiling.",
    thinkMs: 900,
  },
];

/** Human label used in research cards. */
export function signalLabel(tone: "bullish" | "neutral"): string {
  return tone === "bullish" ? "Bullish tilt" : "Neutral setup";
}
