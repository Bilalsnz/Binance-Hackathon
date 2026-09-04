import type {
  Decision,
  GuardContext,
  Policy,
  PolicyCheck,
  ProposedAction,
  RuleId,
} from "./types";
import { V2_RULE_ORDER } from "./rules";

/**
 * The Mandate policy engine — pure, deterministic application logic.
 *
 * `evaluateAction` runs a proposed action against every rule the policy
 * declares and returns a structured `Decision`. The engine has no I/O and no
 * hidden state: everything it needs arrives as arguments, so it is trivially
 * testable and safe to run on the server, the client or in a unit test.
 *
 * Context: pass a `GuardContext` (book summary) as the third argument for the
 * aggregate rules (daily-loss halt, per-asset concentration, order rate, daily
 * notional). A bare number is accepted as shorthand for `{ exposureUsd: n }`
 * and keeps ad-hoc callers working — but the aggregate rules are only fully
 * enforced when the caller supplies the book, which is the documented contract
 * of the Guard API.
 *
 * Exposure model: `ctx.exposureUsd` is the USD notional the agent already
 * holds at ENTRY (buys it executed). Mark-to-market P&L never changes exposure
 * until realized by a sell; the daily-loss rule counts only realized losses.
 */

const ruleLabel: Record<RuleId, string> = {
  capital: "Capital limit",
  "allowed-assets": "Allowed assets",
  "position-size": "Position size",
  "risk-per-trade": "Risk per trade",
  market: "Market permission",
  withdrawals: "Withdrawal policy",
  "daily-loss": "Daily loss halt",
  concentration: "Concentration",
  "order-rate": "Order rate",
  "daily-notional": "Daily buy notional",
};

/** A failing `PolicyCheck` carries its own readable label through the UI. */
export function ruleLabelOf(rule: RuleId): string {
  return ruleLabel[rule];
}

function check(rule: RuleId, passed: boolean, detail: string): PolicyCheck {
  return { rule, passed, detail };
}

function money(n: number): string {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString("en-US")}`;
}

/** Format a USD amount compactly, e.g. 12500 → "$12,500". */
export function formatUsd(n: number): string {
  return n < 0 ? `-${money(Math.abs(n))}` : money(n);
}

function toContext(exposureOrCtx: number | GuardContext): GuardContext {
  return typeof exposureOrCtx === "number" ? { exposureUsd: exposureOrCtx } : exposureOrCtx;
}

export function evaluateAction(
  policy: Policy,
  action: ProposedAction,
  exposureOrCtx: number | GuardContext = 0,
  now = new Date().toISOString()
): Decision {
  const ctx = toContext(exposureOrCtx);
  const currentExposureUsd = ctx.exposureUsd;
  const checks: PolicyCheck[] = [];
  const symbol = action.symbol.toUpperCase();
  const notional = action.notionalUsd;

  // 1 · Capital limit — only buys put new capital at risk.
  if (action.kind === "trade" && action.side === "buy") {
    const after = currentExposureUsd + notional;
    if (after <= policy.maxCapitalUsd) {
      checks.push(
        check(
          "capital",
          true,
          `Exposure ${money(after)} ≤ limit ${money(policy.maxCapitalUsd)}`
        )
      );
    } else {
      checks.push(
        check(
          "capital",
          false,
          `Exposure would hit ${money(after)} — over the ${money(
            policy.maxCapitalUsd
          )} capital limit`
        )
      );
    }
  } else {
    checks.push(
      check("capital", true, `No new capital at risk (${action.side})`)
    );
  }

  // 2 · Allowed assets — applies to trades on a base symbol.
  const allowed = policy.allowedAssets.map((a) => a.toUpperCase());
  if (action.kind === "trade") {
    if (allowed.includes(symbol)) {
      checks.push(check("allowed-assets", true, `${symbol} is on the allowlist`));
    } else {
      checks.push(
        check(
          "allowed-assets",
          false,
          `${symbol} is not on the allowlist (${allowed.join(", ") || "empty"})`
        )
      );
    }
  } else {
    checks.push(check("allowed-assets", true, "Not an asset trade"));
  }

  // 3 · Position size — cumulative per-asset position cap. A buy is refused
  // when it would push what the agent already holds in that asset over the cap,
  // so splitting a big intent into many small orders can never dodge it. On a
  // book that reports no positions this degenerates to a plain per-order cap.
  const heldInAsset =
    action.kind === "trade" ? (ctx.positions?.[symbol] ?? 0) : 0;
  if (action.kind === "trade" && action.side === "buy") {
    const after = heldInAsset + notional;
    if (after <= policy.maxPositionUsd) {
      checks.push(
        check(
          "position-size",
          true,
          heldInAsset > 0
            ? `${money(heldInAsset)} held + ${money(notional)} → ${money(
                after
              )} ${symbol} ≤ position cap ${money(policy.maxPositionUsd)}`
            : `${money(notional)} ≤ position cap ${money(policy.maxPositionUsd)}`
        )
      );
    } else {
      checks.push(
        check(
          "position-size",
          false,
          heldInAsset > 0
            ? `${symbol} would reach ${money(after)} (${money(
                heldInAsset
              )} held + ${money(notional)}) — over the ${money(
                policy.maxPositionUsd
              )} position cap; small orders add up`
            : `${money(notional)} exceeds the ${money(
                policy.maxPositionUsd
              )} position cap`
        )
      );
    }
  } else if (action.kind === "trade" && action.side === "sell") {
    checks.push(check("position-size", true, "Not a size increase (sell)"));
  } else {
    checks.push(check("position-size", true, "Not a market buy"));
  }

  // 4 · Risk per trade — the agent's own worst-case estimate must fit.
  if (action.kind === "trade") {
    const risk = action.estRiskUsd ?? 0;
    if (risk <= policy.maxLossPerTradeUsd) {
      checks.push(
        check(
          "risk-per-trade",
          true,
          `Estimated risk ${money(risk)} ≤ ${money(
            policy.maxLossPerTradeUsd
          )} allowed`
        )
      );
    } else {
      checks.push(
        check(
          "risk-per-trade",
          false,
          `Estimated risk ${money(risk)} exceeds the ${money(
            policy.maxLossPerTradeUsd
          )} per-trade loss cap`
        )
      );
    }
  } else {
    checks.push(check("risk-per-trade", true, "Not a market trade"));
  }

  // 5 · Market permission — futures are opt-in, whatever the asset.
  if (action.market === "futures") {
    if (policy.allowFutures) {
      checks.push(check("market", true, "Futures are enabled by policy"));
    } else {
      checks.push(
        check("market", false, "Futures are disabled by policy (spot only)")
      );
    }
  } else {
    checks.push(check("market", true, "Spot trading is permitted"));
  }

  // 6 · Withdrawal policy — the agent can never move funds out without a rule.
  if (action.kind === "withdraw") {
    if (policy.allowWithdrawals) {
      checks.push(check("withdrawals", true, "Withdrawals are enabled"));
    } else {
      checks.push(
        check(
          "withdrawals",
          false,
          "Withdrawals are disabled by policy — no outbound transfers"
        )
      );
    }
  } else {
    checks.push(check("withdrawals", true, "Not a withdrawal"));
  }

  // 7-10 · v2 aggregate rules (standalone modules in ./rules). Folded in a
  // fixed order so the decision card and tests agree on the sequence.
  for (const ruleFn of V2_RULE_ORDER) {
    checks.push(ruleFn(policy, action, ctx));
  }

  const blockedBy = checks.filter((c) => !c.passed);
  const state: Decision["state"] = blockedBy.length ? "blocked" : "approved";

  const exposureAfterUsd =
    action.kind === "trade" && action.side === "buy"
      ? currentExposureUsd + notional
      : action.kind === "trade" && action.side === "sell"
        ? Math.max(0, currentExposureUsd - notional)
        : currentExposureUsd;

  const requiresApproval = state === "approved" && policy.requireApproval;

  return {
    state,
    checks,
    blockedBy,
    requiresApproval,
    exposureAfterUsd,
    evaluatedAt: now,
  };
}

/** Short, single-sentence reason for a blocked decision (for badges/titles). */
export function blockedReason(decision: Decision): string {
  const label = decision.blockedBy
    .map((c) => ruleLabelOf(c.rule))
    .join(" + ");
  return label || "Policy check failed";
}
