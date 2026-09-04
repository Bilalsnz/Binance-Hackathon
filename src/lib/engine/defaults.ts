import type { Policy } from "./types";

/**
 * Defaults for the demo experience and the pre-loaded sample policy.
 * The values mirror the judge script from the brief:
 *   allow BTC + ETH · $500 capital ceiling · $150 max position ·
 *   $20 max loss · spot only · withdrawals off · approval required.
 *
 * The $500 ceiling is deliberately above any single demo order so the
 * $250 BTC proposal is blocked by the *position* cap ($150), not the
 * aggregate ceiling — giving the judge one crisp reason per verdict.
 *
 * v2 guardrails are defaulted wide enough that they never fire in the happy
 * demo script (so every scripted verdict keeps its single crisp reason), but
 * tight enough that a judge can turn one down and immediately flip a verdict:
 *    · $60 daily-loss halt    (no realized losses in the happy demo)
 *    · $400 per-asset cap     ($100 BTC + $250 probe stays under it)
 *    · 15 orders / day        (script places a handful)
 *    · $700 daily notional    (script's approved buys total $160)
 */

export const DEFAULT_POLICY: Policy = {
  name: "Guardian mandate",
  version: 1,
  maxCapitalUsd: 500,
  allowedAssets: ["BTC", "ETH"],
  maxPositionUsd: 150,
  maxLossPerTradeUsd: 20,
  allowFutures: false,
  allowWithdrawals: false,
  requireApproval: true,
  dailyLossLimitUsd: 60,
  maxSingleAssetUsd: 400,
  maxOrdersPerDay: 15,
  maxDailyNotionalUsd: 700,
  updatedAt: "2026-09-01T09:00:00.000Z",
};

/** Build a policy from defaults, overriding any fields. */
export function makePolicy(partial: Partial<Policy> = {}): Policy {
  return { ...DEFAULT_POLICY, ...partial };
}

/**
 * Migrate a policy that may predate the v2 guardrail fields (older persisted
 * localStorage blobs) by filling every missing field with its default. Never
 * throws; unknown fields from future versions are kept untouched.
 */
export function normalizePolicy(raw: Partial<Policy> | null | undefined): Policy {
  return { ...DEFAULT_POLICY, ...(raw ?? {}) };
}
