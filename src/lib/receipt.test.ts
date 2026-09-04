import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReceipt, verifyReceipt } from "./receipt";
import type { AuditEvent, Policy, PolicyVersionRecord } from "./engine/types";

function ev(seq: number, extra: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: `ev-${seq}`,
    seq,
    ts: new Date(Date.UTC(2026, 0, seq + 1)).toISOString(),
    event: "policy-decision",
    actor: "Nova",
    summary: `Buy $100 BTC`,
    tone: "ok",
    mode: "demo",
    source: "simulated",
    action: {
      id: `act-${seq}`,
      createdAt: new Date(Date.UTC(2026, 0, seq + 1)).toISOString(),
      actor: "Nova",
      goal: "Grow",
      kind: "trade",
      market: "spot",
      symbol: "BTC",
      side: "buy",
      notionalUsd: 100,
      estRiskUsd: 5,
      reason: "test",
    },
    checks: [{ rule: "capital", passed: true, detail: "within cap" }],
    verdict: "approved",
    requiresApproval: false,
    approvalState: "approved",
    reason: undefined,
    policyVersion: 1,
    payload: {
      kind: "trade",
      market: "spot",
      symbol: "BTC",
      side: "buy",
      notionalUsd: 100,
      estRiskUsd: 5,
      intent: "Grow",
      params: { notionalUsd: 100, symbol: "BTC", market: "spot", side: "buy" },
    },
    sentToBroker: true,
    intent: "user",
    prompt: undefined,
    ...extra,
  };
}

const policy = {
  version: 1,
  name: "Guardian",
} as unknown as Policy;

const history = [
  { version: 1, changedAt: "2026-01-01T00:00:00.000Z", policy: {} as Policy, diff: [] },
] as PolicyVersionRecord[];

test("receipt: sha-256 chain is built oldest-first and self-verifies intact", async () => {
  const events = [ev(1), ev(2), ev(3)];
  const receipt = await buildReceipt({ events, policy, policyHistory: history });
  assert.equal(receipt.schema, "agentguard.receipt.v1");
  assert.equal(receipt.algorithm, "sha-256");
  assert.equal(receipt.links.length, 3);
  assert.match(receipt.chainTip, /^[0-9a-f]{64}$/);
  assert.equal(receipt.links[0].prevHash, "GENESIS");
  assert.equal(receipt.links[1].prevHash, receipt.links[0].hash);

  const check = await verifyReceipt(receipt);
  assert.deepEqual(check, { valid: true, links: 3, algorithm: "sha-256" });
});

test("receipt: editing an event body breaks the chain at that row", async () => {
  const events = [ev(1, { policyVersion: 1 }), ev(2)];
  const receipt = await buildReceipt({ events, policy, policyHistory: history });

  // Tamper: rewrite the second row's body (as an attacker editing the file would).
  const bad = structuredClone(receipt);
  bad.links[1].body = bad.links[1].body.replace('"notionalUsd":100', '"notionalUsd":9000');

  const check = await verifyReceipt(bad);
  assert.equal(check.valid, false);
  if (!check.valid) assert.equal(check.firstBadLink, 1);
});

test("receipt: deleting a row is detected via chain-tip mismatch", async () => {
  const events = [ev(1), ev(2), ev(3)];
  const receipt = await buildReceipt({ events, policy, policyHistory: history });
  const bad = structuredClone(receipt);
  bad.links.splice(1, 1); // attacker removes the middle row

  const check = await verifyReceipt(bad);
  assert.equal(check.valid, false);
});

test("receipt: reordering rows is detected", async () => {
  const events = [ev(1), ev(2)];
  const receipt = await buildReceipt({ events, policy, policyHistory: history });
  const bad = structuredClone(receipt);
  bad.links.reverse();

  const check = await verifyReceipt(bad);
  assert.equal(check.valid, false);
});

test("receipt: different inputs produce different chain tips", async () => {
  const a = await buildReceipt({ events: [ev(1, { policyVersion: 1 })], policy, policyHistory: history });
  const b = await buildReceipt({ events: [ev(1, { policyVersion: 2 })], policy, policyHistory: history });
  assert.notEqual(a.chainTip, b.chainTip);
});
