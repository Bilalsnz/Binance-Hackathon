import type {
  Decision,
  Policy,
  PolicyCheck,
  ProposedAction,
  RuleId,
} from "./types";

/**
 * The AgentGuard policy engine — pure, deterministic application logic.
 *
 * `evaluateAction` runs a proposed action against every rule the policy
 * declares and returns a structured `Decision`. The engine has no I/O and no
 * hidden state: everything it needs arrives as arguments, so it is trivially
 * testable and safe to run on the server, the client or in a unit test.
 *
 * Exposure model: `currentExposureUsd` is the USD notional the agent already
 * holds (buys it executed). Only buys add exposure; sells, internal transfers
 * and withdrawals do not increase capital at risk.
 */

const ruleLabel: Record<RuleId, string> = {
  capital: "Capital limit",
  "allowed-assets": "Allowed assets",
  "position-size": "Position size",
  "risk-per-trade": "Risk per trade",
  market: "Market permission",
  withdrawals: "Withdrawal policy",
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

export function evaluateAction(
  policy: Policy,
  action: ProposedAction,
  currentExposureUsd = 0,
  now = new Date().toISOString()
): Decision {
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

  // 3 · Position size — single-order notional cap.
  if (notional <= policy.maxPositionUsd) {
    checks.push(
      check(
        "position-size",
        true,
        `${money(notional)} ≤ per-position cap ${money(policy.maxPositionUsd)}`
      )
    );
  } else {
    checks.push(
      check(
        "position-size",
        false,
        `${money(notional)} exceeds the ${money(
          policy.maxPositionUsd
        )} position cap`
      )
    );
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
