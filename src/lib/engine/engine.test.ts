import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateAction, blockedReason } from "./policy";
import { makePolicy } from "./defaults";
import type { Policy, ProposedAction } from "./types";

/**
 * Tests that mirror the judge script from the hackathon brief:
 *   allowed BTC · oversized BTC · disallowed SOL · futures disabled ·
 *   withdrawals disabled · approval required.
 */

const NOW = "2026-09-01T10:00:00.000Z";
let n = 0;
const aid = () => `act-${++n}`;

function action(partial: Partial<ProposedAction>): ProposedAction {
  return {
    id: aid(),
    createdAt: NOW,
    actor: "test-agent",
    goal: "test",
    kind: "trade",
    market: "spot",
    symbol: "BTC",
    side: "buy",
    notionalUsd: 100,
    estRiskUsd: 10,
    reason: "test",
    ...partial,
  };
}

function approved(decision: ReturnType<typeof evaluateAction>) {
  assert.equal(decision.state, "approved");
  assert.equal(decision.blockedBy.length, 0, "no failing checks");
}

function blockedByRule(decision: ReturnType<typeof evaluateAction>, rule: string) {
  assert.equal(decision.state, "blocked");
  assert.ok(
    decision.blockedBy.some((c) => c.rule === rule),
    `expected a failing "${rule}" check, got: ${decision.blockedBy
      .map((c) => c.rule)
      .join(",")}`
  );
}

describe("AgentGuard policy engine", () => {
  it("approves an in-policy BTC buy that stays within every limit", () => {
    const d = evaluateAction(makePolicy(), action({ notionalUsd: 100, estRiskUsd: 12 }), 0, NOW);
    approved(d);
    assert.equal(d.requiresApproval, true);
    assert.equal(d.exposureAfterUsd, 100);
    assert.equal(d.checks.length, 10, "every rule (6 core + 4 v2) is checked and reported");
  });

  it("blocks an oversized BTC buy (position limit exceeded)", () => {
    const d = evaluateAction(makePolicy(), action({ notionalUsd: 250 }), 0, NOW);
    blockedByRule(d, "position-size");
    assert.ok(blockedReason(d).includes("Position size"));
  });

  it("blocks buying SOL when SOL is not an allowed asset", () => {
    const d = evaluateAction(makePolicy(), action({ symbol: "SOL", notionalUsd: 100 }), 0, NOW);
    blockedByRule(d, "allowed-assets");
  });

  it("is case-insensitive on allowed assets", () => {
    const d = evaluateAction(makePolicy(), action({ symbol: "eth", notionalUsd: 80 }), 0, NOW);
    approved(d);
  });

  it("blocks futures when derivatives are disabled", () => {
    const d = evaluateAction(
      makePolicy({ allowFutures: false }),
      action({ market: "futures", side: "buy", notionalUsd: 100 }),
      0,
      NOW
    );
    blockedByRule(d, "market");
  });

  it("permits futures when the policy enables them", () => {
    const d = evaluateAction(
      makePolicy({ allowFutures: true }),
      action({ market: "futures", side: "buy", notionalUsd: 100 }),
      0,
      NOW
    );
    approved(d);
  });

  it("blocks withdrawals when withdrawals are disabled", () => {
    const d = evaluateAction(
      makePolicy({ allowWithdrawals: false }),
      action({ kind: "withdraw", symbol: "USDT", side: "buy", notionalUsd: 50 }),
      0,
      NOW
    );
    blockedByRule(d, "withdrawals");
  });

  it("blocks every action when approval is required until the human confirms", () => {
    const d = evaluateAction(
      makePolicy({ requireApproval: true }),
      action({ notionalUsd: 90 }),
      0,
      NOW
    );
    approved(d);
    assert.equal(d.requiresApproval, true, "approved action must wait for a human");
  });

  it("does not force approval when the policy opts out", () => {
    const d = evaluateAction(
      makePolicy({ requireApproval: false }),
      action({ notionalUsd: 90 }),
      0,
      NOW
    );
    approved(d);
    assert.equal(d.requiresApproval, false);
  });

  it("blocks when a buy would push running exposure over the capital limit", () => {
    const policy: Policy = makePolicy({ maxCapitalUsd: 200 });
    const d = evaluateAction(policy, action({ notionalUsd: 150 }), 100, NOW);
    blockedByRule(d, "capital");
    assert.equal(d.exposureAfterUsd, 250);
  });

  it("still approves a buy that fits under the capital limit given existing exposure", () => {
    const policy: Policy = makePolicy({ maxCapitalUsd: 200 });
    const d = evaluateAction(policy, action({ notionalUsd: 50 }), 100, NOW);
    approved(d);
    assert.equal(d.exposureAfterUsd, 150);
  });

  it("treats a sell as risk-reducing, not new exposure", () => {
    const d = evaluateAction(makePolicy(), action({ side: "sell", notionalUsd: 60 }), 100, NOW);
    approved(d);
    assert.equal(d.exposureAfterUsd, 40);
  });

  it("blocks when the agent's estimated loss exceeds the risk cap", () => {
    const d = evaluateAction(
      makePolicy({ maxLossPerTradeUsd: 20 }),
      action({ notionalUsd: 100, estRiskUsd: 90 }),
      0,
      NOW
    );
    blockedByRule(d, "risk-per-trade");
  });

  it("returns a structured reason for every blocking rule", () => {
    const d = evaluateAction(
      makePolicy({ allowWithdrawals: false }),
      action({ kind: "withdraw", symbol: "USDT", notionalUsd: 500, side: "buy" }),
      0,
      NOW
    );
    blockedByRule(d, "withdrawals");
    assert.ok(d.blockedBy[0].detail.length > 8, "detail must explain the failure");
    assert.equal(d.checks.every((c) => c.detail.length > 0), true);
  });
});
