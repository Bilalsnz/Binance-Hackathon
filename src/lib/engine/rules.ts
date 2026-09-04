import type {
  GuardContext,
  Policy,
  PolicyCheck,
  ProposedAction,
} from "./types";

/**
 * v2 aggregate/risk rule modules — each is a pure function that returns one
 * `PolicyCheck`. Keeping them standalone makes the engine's rule set easy to
 * extend, reason about and test in isolation. `policy.ts` calls every module
 * in a fixed order and folds the checks into the `Decision`.
 *
 * The modules only enforce rules for which the caller supplied data
 * (`GuardContext`). A caller that omits the book (ad-hoc tests, pre-context
 * callers) gets checks that PASS with an explanatory note — the guard is only
 * as strong as the book it is handed, and that boundary is documented.
 */

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Daily realized-loss / drawdown halt. Trades only. */
export function checkDailyLoss(
  p: Policy,
  a: ProposedAction,
  c: GuardContext
): PolicyCheck {
  const rule = "daily-loss" as const;
  if (a.kind !== "trade") {
    return { rule, passed: true, detail: "Not a trade — halt rule not applicable" };
  }
  const loss = c.realizedLossTodayUsd ?? 0;
  if (loss >= p.dailyLossLimitUsd) {
    return {
      rule,
      passed: false,
      detail: `Daily loss halt — ${money(loss)} realized today meets the ${money(
        p.dailyLossLimitUsd
      )} stop. No more trades until tomorrow.`,
    };
  }
  return {
    rule,
    passed: true,
    detail: `Realized loss today ${money(loss)} < halt at ${money(
      p.dailyLossLimitUsd
    )}`,
  };
}

/** Per-asset concentration cap (notional held vs cap). */
export function checkConcentration(
  p: Policy,
  a: ProposedAction,
  c: GuardContext
): PolicyCheck {
  const rule = "concentration" as const;
  const symbol = a.symbol.toUpperCase();
  if (a.kind !== "trade") {
    return { rule, passed: true, detail: "Not an asset trade — concentration N/A" };
  }
  const held = c.positions?.[symbol] ?? 0;
  const after =
    a.side === "buy"
      ? held + a.notionalUsd
      : Math.max(0, held - a.notionalUsd);
  if (after <= p.maxSingleAssetUsd) {
    return {
      rule,
      passed: true,
      detail: `Held ${money(held)} → ${money(after)} ${symbol} ≤ per-asset cap ${money(
        p.maxSingleAssetUsd
      )}`,
    };
  }
  return {
    rule,
    passed: false,
    detail: `${symbol} would reach ${money(after)} — over the ${money(
      p.maxSingleAssetUsd
    )} per-asset concentration cap (small buys add up)`,
  };
}

/** Daily order-count rate limit — blocks micro-order splitting. */
export function checkOrderRate(
  p: Policy,
  a: ProposedAction,
  c: GuardContext
): PolicyCheck {
  const rule = "order-rate" as const;
  if (a.kind === "transfer") {
    return { rule, passed: true, detail: "Internal transfer — not an order" };
  }
  const done = c.ordersToday ?? 0;
  if (done >= p.maxOrdersPerDay) {
    return {
      rule,
      passed: false,
      detail: `Order rate limit — ${done} orders today already meet the ${p.maxOrdersPerDay}/day cap`,
    };
  }
  return {
    rule,
    passed: true,
    detail: `${done}/${p.maxOrdersPerDay} orders today — within the rate cap`,
  };
}

/** Aggregate daily buy-notional cap — many small orders can't bypass it. */
export function checkDailyNotional(
  p: Policy,
  a: ProposedAction,
  c: GuardContext
): PolicyCheck {
  const rule = "daily-notional" as const;
  if (a.kind !== "trade" || a.side !== "buy") {
    return {
      rule,
      passed: true,
      detail: a.kind === "trade" ? "Not a buy — no new notional" : "Not a trade",
    };
  }
  const done = c.dailyNotionalUsd ?? 0;
  const after = done + a.notionalUsd;
  if (after <= p.maxDailyNotionalUsd) {
    return {
      rule,
      passed: true,
      detail: `Buy notional today ${money(done)} → ${money(
        after
      )} ≤ ${money(p.maxDailyNotionalUsd)} daily cap`,
    };
  }
  return {
    rule,
    passed: false,
    detail: `Daily buy notional would hit ${money(after)} — over the ${money(
      p.maxDailyNotionalUsd
    )} cap (splitting into small orders does not help)`,
  };
}

/** Deterministic evaluation order shared by the engine and tests. */
export const V2_RULE_ORDER = [
  checkDailyLoss,
  checkConcentration,
  checkOrderRate,
  checkDailyNotional,
] as const;
