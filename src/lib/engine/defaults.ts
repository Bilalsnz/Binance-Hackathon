import type { Policy } from "./types";

/**
 * Defaults for the demo experience and the pre-loaded sample policy.
 * The values mirror the judge script from the brief:
 *   allow BTC + ETH · $150 max position · $20 max loss · spot only ·
 *   withdrawals off · approval required.
 */

export const DEFAULT_POLICY: Policy = {
  name: "Guardian mandate",
  maxCapitalUsd: 300,
  allowedAssets: ["BTC", "ETH"],
  maxPositionUsd: 150,
  maxLossPerTradeUsd: 20,
  allowFutures: false,
  allowWithdrawals: false,
  requireApproval: true,
  updatedAt: "2026-09-01T09:00:00.000Z",
};

/** Build a policy from defaults, overriding any fields. */
export function makePolicy(partial: Partial<Policy> = {}): Policy {
  return { ...DEFAULT_POLICY, ...partial };
}
