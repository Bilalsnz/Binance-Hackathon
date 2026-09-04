import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY } from "@/lib/engine/defaults";
import { evaluateAction } from "@/lib/engine/policy";
import { SCENARIOS, scenarioAction } from "./scenarios";

/**
 * The quick-launch scenarios must always tell the judge the same story as the
 * full 60-second demo: exactly one crisp reason per verdict under the default
 * "Guardian mandate". These tests pin that so a future policy edit can never
 * silently change what a scenario card promises.
 */

test("$100 BTC scenario is approved and requires human OK (default policy)", () => {
  const sc = SCENARIOS.find((s) => s.id === "buy-100-btc")!;
  const d = evaluateAction(DEFAULT_POLICY, scenarioAction(sc), 0);
  assert.equal(d.state, "approved");
  assert.equal(d.blockedBy.length, 0);
  assert.equal(d.requiresApproval, true);
});

test("$250 BTC scenario is blocked by position-size — not capital", () => {
  const sc = SCENARIOS.find((s) => s.id === "scale-250-btc")!;
  // Even after a $100 BTC fill, the ceiling ($500) still passes; the single
  // crisp reason must remain the $150 position cap.
  const d = evaluateAction(DEFAULT_POLICY, scenarioAction(sc), 100);
  assert.equal(d.state, "blocked");
  assert.equal(d.blockedBy.length, 1);
  assert.equal(d.blockedBy[0].rule, "position-size");
  assert.match(d.blockedBy[0].detail, /position cap/);
});

test("$80 SOL scenario is blocked by the allowlist", () => {
  const sc = SCENARIOS.find((s) => s.id === "sol-80")!;
  const d = evaluateAction(DEFAULT_POLICY, scenarioAction(sc), 0);
  assert.equal(d.state, "blocked");
  assert.equal(d.blockedBy[0].rule, "allowed-assets");
  assert.match(d.blockedBy[0].detail, /not on the allowlist/);
});

test("BTC futures scenario is blocked because derivatives are disabled", () => {
  const sc = SCENARIOS.find((s) => s.id === "btc-futures")!;
  const d = evaluateAction(DEFAULT_POLICY, scenarioAction(sc), 0);
  assert.equal(d.state, "blocked");
  assert.equal(d.blockedBy[0].rule, "market");
  assert.match(d.blockedBy[0].detail, /Futures are disabled/);
});

test("Withdraw $40 scenario is blocked because withdrawals are locked", () => {
  const sc = SCENARIOS.find((s) => s.id === "withdraw-40")!;
  const d = evaluateAction(DEFAULT_POLICY, scenarioAction(sc), 0);
  assert.equal(d.state, "blocked");
  assert.equal(d.blockedBy[0].rule, "withdrawals");
  assert.match(d.blockedBy[0].detail, /Withdrawals are disabled/);
});

test("every scenario points at an action step in the demo script", () => {
  for (const sc of SCENARIOS) {
    assert.ok(scenarioAction(sc).symbol, `${sc.id} builds an action`);
    assert.ok(scenarioAction(sc).notionalUsd > 0, `${sc.id} has a notional`);
  }
});
