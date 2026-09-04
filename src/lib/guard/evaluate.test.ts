import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateGuardRequest } from "./evaluate";
import { DEFAULT_POLICY } from "@/lib/engine/defaults";
import type { GuardEvaluateRequest, GuardActionInput } from "./evaluate";
import type { RuleId } from "@/lib/engine/types";

/** Default-policy eval that shares a rich book so aggregate rules fire. */
function req(partial: Partial<GuardActionInput>, extra: Partial<GuardEvaluateRequest> = {}): GuardEvaluateRequest {
  return {
    policy: extra.policy ?? DEFAULT_POLICY,
    action: {
      symbol: "BTC",
      side: "buy",
      kind: "trade",
      market: "spot",
      notionalUsd: 100,
      estRiskUsd: 12,
      goal: "accumulate BTC",
      ...partial,
    },
    context: {
      exposureUsd: 0,
      positions: { BTC: 0 },
      realizedLossTodayUsd: 0,
      ordersToday: 0,
      dailyNotionalUsd: 0,
      ...extra.context,
    },
  };
}

/** A deliberately malformed request (bypasses TS so runtime validation runs). */
function bad(action: Record<string, unknown>): GuardEvaluateRequest {
  return { policy: {}, action } as unknown as GuardEvaluateRequest;
}

function approved(r: GuardEvaluateRequest) {
  const res = evaluateGuardRequest(r);
  assert.equal(res.valid, true);
  if (!res.valid) return res;
  assert.equal(res.ok, true, res.reason);
  assert.equal(res.state, "approved");
  return res;
}

function blockedBy(r: GuardEvaluateRequest, rule: RuleId) {
  const res = evaluateGuardRequest(r);
  assert.equal(res.valid, true);
  if (!res.valid) return res;
  assert.equal(res.ok, false, "expected the guard to refuse");
  assert.ok(
    res.blockingRules.includes(rule),
    `expected "${rule}" to fire, got: ${res.blockingRules.join(",")}`
  );
  return res;
}

describe("Guard API evaluation (server-safe, no I/O)", () => {
  it("approves an in-policy BTC buy and reports the normalized payload", () => {
    const res = approved(req({ notionalUsd: 100 }));
    assert.equal(res.policyVersion, DEFAULT_POLICY.version);
    assert.equal(res.payload.symbol, "BTC");
    assert.equal(res.payload.params.notionalUsd, 100);
    assert.equal(res.payload.intent, "accumulate BTC");
    assert.equal(res.decision.requiresApproval, true);
    assert.deepEqual(res.warnings, [], "rich book ⇒ every aggregate rule enforced");
  });

  it("refuses an oversized BTC buy with the exact rule + reason", () => {
    const res = blockedBy(req({ notionalUsd: 250 }), "position-size");
    assert.match(res.reason, /position-size/);
    assert.ok(res.reason.length > 10, "reason must explain the refusal");
  });

  it("refuses an asset that is not on the allowlist", () => {
    blockedBy(req({ symbol: "SOL", notionalUsd: 80 }), "allowed-assets");
  });

  it("refuses withdrawals when the mandate disables them", () => {
    blockedBy(
      req(
        { symbol: "USDT", kind: "withdraw", market: "spot", notionalUsd: 40, estRiskUsd: 0 },
        { policy: { ...DEFAULT_POLICY, allowWithdrawals: false } }
      ),
      "withdrawals"
    );
  });

  it("enforces the daily-notional aggregate when the caller sends its book", () => {
    const res = blockedBy(
      req({ notionalUsd: 300 }, { context: { dailyNotionalUsd: 500 } }),
      "daily-notional"
    );
    assert.equal(
      res.decision.exposureAfterUsd,
      300,
      "exposureAfter is the would-be post-fill state, not 0 — the book never moved"
    );
  });

  it("honours a caller policy that raises the position cap (verdict flips)", () => {
    approved(req({ notionalUsd: 250 }, { policy: { ...DEFAULT_POLICY, maxPositionUsd: 500 } }));
  });

  it("warns which aggregate rules could NOT be enforced with a thin book", () => {
    const res = evaluateGuardRequest({
      policy: DEFAULT_POLICY,
      action: { symbol: "BTC", side: "buy", notionalUsd: 40 },
      context: { exposureUsd: 0 },
    });
    assert.equal(res.valid, true);
    if (!res.valid) return;
    assert.ok(res.ok);
    assert.ok(res.warnings.length >= 3, "thin book ⇒ aggregate rules unenforced + disclosed");
    assert.ok(res.warnings.some((w) => w.includes("concentration")));
  });

  it("rejects malformed inputs without evaluating", () => {
    assert.equal(evaluateGuardRequest(bad({ symbol: "BTC", side: "buy", notionalUsd: -5 })).valid, false);
    assert.equal(evaluateGuardRequest(bad({ symbol: "BTC", side: "sideways", notionalUsd: 10 })).valid, false);
    assert.equal(evaluateGuardRequest(bad({ symbol: "", side: "buy", notionalUsd: 10 })).valid, false);
    assert.equal(evaluateGuardRequest(bad({ symbol: "BTC", side: "buy", notionalUsd: "lots" })).valid, false);
    assert.equal(evaluateGuardRequest(bad({ symbol: "BTC", side: "buy", kind: "teleport" })).valid, false);
    assert.equal(evaluateGuardRequest({} as GuardEvaluateRequest).valid, false);
    assert.equal(evaluateGuardRequest(null as never).valid, false);
  });

  it("exposes exposureAfter so the caller knows the post-fill state", () => {
    const res = approved(req({ notionalUsd: 120 }));
    assert.equal(res.decision.exposureAfterUsd, 120);
  });
});
