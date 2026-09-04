import type { Policy, PolicyVersionRecord } from "./types";

/** JSON-safe field order for diffing (arrays sorted so reordering is no diff). */
const FIELD_ORDER = [
  "name",
  "maxCapitalUsd",
  "allowedAssets",
  "maxPositionUsd",
  "maxLossPerTradeUsd",
  "allowFutures",
  "allowWithdrawals",
  "requireApproval",
  "dailyLossLimitUsd",
  "maxSingleAssetUsd",
  "maxOrdersPerDay",
  "maxDailyNotionalUsd",
];

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return [...v].sort();
  return v;
}

/** Field-level before/after diff between two policy versions. */
export function diffPolicies(
  before: Policy,
  after: Policy
): PolicyVersionRecord["diff"] {
  const diff: PolicyVersionRecord["diff"] = [];
  for (const field of FIELD_ORDER) {
    const b = canonical((before as unknown as Record<string, unknown>)[field]);
    const a = canonical((after as unknown as Record<string, unknown>)[field]);
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff.push({ field, before: b, after: a });
    }
  }
  return diff;
}

/** Build the next version record for a mandate save (no side effects). */
export function nextPolicyRecord(
  previous: Policy,
  next: Policy
): PolicyVersionRecord {
  return {
    version: (previous.version ?? 0) + 1,
    changedAt: next.updatedAt || new Date(0).toISOString(),
    policy: next,
    diff: diffPolicies(previous, next),
  };
}
