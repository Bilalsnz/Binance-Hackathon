import type {
  Decision,
  GuardContext,
  Policy,
  ProposedAction,
  RuleId,
} from "@/lib/engine/types";
import { evaluateAction } from "@/lib/engine/policy";
import { AGENT_NAME } from "./script";

/**
 * Stacking analysis ("would many small buys sneak past the cap?").
 *
 * A single tool call is one order, so a stacking attack is a SEQUENCE — the
 * guard must catch it the same way, by counting what the agent already holds.
 * `planStack` replays that sequence through the real `evaluateAction`, drips
 * forward the book only when the guard allows an order, and stops at the first
 * refusal. Every verdict inside is real engine output under the current policy;
 * the ONLY hypothetical is the assumption that the guard's allowed drips get
 * approved/executed so the attacker can keep going — which is exactly the point
 * the demo makes: drip as long as you like, the position cap still stops you.
 *
 * No fills are ever claimed to a broker here: each step carries its own
 * `decision` and the first blocked one is shown with `sentToBroker: false`.
 */

export interface StackStep {
  order: number;
  action: ProposedAction;
  decision: Decision;
}

export interface StackPlan {
  symbol: string;
  perOrderUsd: number;
  positionCapUsd: number;
  steps: StackStep[];
  /** The order the guard refused (undefined when every step passed). */
  firstBlocked: StackStep | null;
  firstBlockedRule: RuleId | null;
  /** Cumulative held in the asset after the allowed drips, USD (entry). */
  wouldHoldUsd: number;
}

function microAction(symbol: string, perOrderUsd: number, order: number): ProposedAction {
  return {
    id: `stack-${order}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    createdAt: new Date().toISOString(),
    actor: AGENT_NAME,
    goal: `Stack attempt #${order} — drip $${perOrderUsd} of ${symbol}`,
    kind: "trade",
    market: "spot",
    symbol,
    side: "buy",
    notionalUsd: perOrderUsd,
    estRiskUsd: Math.round(perOrderUsd * 0.1),
    reason: `Part ${order} of a drip — each order stays small on its own.`,
  };
}

/** Replay a drip of `perOrderUsd` buys of `symbol` until the guard refuses. */
export function planStack(
  policy: Policy,
  start: GuardContext,
  opts: { symbol?: string; perOrderUsd?: number; maxOrders?: number } = {}
): StackPlan {
  const symbol = (opts.symbol ?? "BTC").toUpperCase();
  const perOrderUsd = opts.perOrderUsd ?? 40;
  const cap = policy.maxPositionUsd;
  const maxOrders =
    opts.maxOrders ?? Math.max(8, Math.ceil(Math.max(0, cap - (start.positions?.[symbol] ?? 0)) / perOrderUsd) + 2);

  // Simulated book — starts from the REAL executed book, then advances only on
  // orders the guard allows.
  const book: GuardContext = {
    exposureUsd: start.exposureUsd ?? 0,
    positions: { ...(start.positions ?? {}) },
    ordersToday: start.ordersToday ?? 0,
    dailyNotionalUsd: start.dailyNotionalUsd ?? 0,
    realizedLossTodayUsd: start.realizedLossTodayUsd,
  };

  const steps: StackStep[] = [];
  let firstBlocked: StackStep | null = null;
  let firstBlockedRule: RuleId | null = null;

  for (let order = 1; order <= maxOrders; order++) {
    const action = microAction(symbol, perOrderUsd, order);
    const decision = evaluateAction(policy, action, { ...book });
    const step: StackStep = { order, action, decision };
    steps.push(step);

    if (decision.state === "blocked") {
      firstBlocked = step;
      firstBlockedRule = decision.blockedBy[0]?.rule ?? null;
      break;
    }
    // The attacker assumes each allowed order is approved; advance the book.
    book.exposureUsd = (book.exposureUsd ?? 0) + perOrderUsd;
    book.positions![symbol] = (book.positions![symbol] ?? 0) + perOrderUsd;
    book.ordersToday = (book.ordersToday ?? 0) + 1;
    book.dailyNotionalUsd = (book.dailyNotionalUsd ?? 0) + perOrderUsd;
  }

  return {
    symbol,
    perOrderUsd,
    positionCapUsd: cap,
    steps,
    firstBlocked,
    firstBlockedRule,
    wouldHoldUsd: book.positions![symbol] ?? 0,
  };
}
