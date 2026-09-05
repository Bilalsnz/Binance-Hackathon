import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBook, initialState, pendingApprovals, reducer } from "./state";

test("begin-demo clears the trail and flags a scripted run", () => {
  const mid = reducer(initialState, {
    type: "append",
    events: [
      {
        id: "x", seq: 0, ts: "t", event: "system", actor: "You", summary: "s",
        tone: "info", mode: "demo", source: "simulated",
      },
    ],
  });
  const started = reducer(mid, { type: "begin-demo" });
  assert.equal(started.events.length, 0);
  assert.equal(started.scriptIndex, 0);
  assert.equal(started.scriptDone, false);
  assert.equal(started.scripted, true);
  assert.equal(started.status, "running");
});

test("a standalone scenario flips the run context to ad-hoc (not scripted)", () => {
  const state = reducer(initialState, { type: "begin-demo" });
  const adhoc = reducer(state, { type: "set-script", scripted: false });
  assert.equal(adhoc.scripted, false);
  assert.equal(adhoc.scriptDone, false); // untouched — resume semantics differ
});

test("clear-all preserves mode/policy but resets the run context", () => {
  const ran = reducer(initialState, { type: "begin-demo" });
  const cleared = reducer(ran, { type: "clear-all" });
  assert.equal(cleared.scripted, false);
  assert.equal(cleared.status, "idle");
  assert.equal(cleared.events.length, 0);
});

test("finishing a script keeps scripted=true but marks it done", () => {
  const ran = reducer(initialState, { type: "begin-demo" });
  const done = reducer(ran, { type: "set-script", done: true });
  assert.equal(done.scriptDone, true);
  assert.equal(done.scripted, true);
});

// ---- policy versioning & history ----

function changedPolicy() {
  return { ...initialState.policy, maxPositionUsd: 90, allowFutures: true };
}

test("set-policy bumps the version and records a field-level history entry", () => {
  const s = reducer(initialState, { type: "set-policy", policy: changedPolicy() });
  assert.equal(s.policy.version, initialState.policy.version + 1);
  assert.equal(s.policy.maxPositionUsd, 90);
  assert.equal(s.policyHistory.length, 1);
  const rec = s.policyHistory[0];
  assert.equal(rec.version, initialState.policy.version + 1);
  const fields = rec.diff.map((d) => d.field).sort();
  assert.deepEqual(fields, ["allowFutures", "maxPositionUsd"]);
});

test("set-policy with no meaningful change keeps the version and history", () => {
  const one = reducer(initialState, { type: "set-policy", policy: changedPolicy() });
  // Same rule values, only the timestamp moved → nothing changed.
  const again = reducer(one, {
    type: "set-policy",
    policy: { ...one.policy, updatedAt: "2026-09-03T00:00:00.000Z" },
  });
  assert.equal(again.policy.version, one.policy.version);
  assert.equal(again.policyHistory.length, 1);
});

test("every subsequent save stacks a monotonic version record", () => {
  const v2 = reducer(initialState, { type: "set-policy", policy: changedPolicy() });
  const v3 = reducer(v2, { type: "set-policy", policy: { ...v2.policy, allowWithdrawals: true } });
  assert.equal(v3.policy.version, v2.policy.version + 1);
  assert.equal(v3.policyHistory.length, 2);
  assert.equal(v3.policyHistory[1].version, v2.policy.version + 1);
});

// ---- lastProposal lifecycle ----

test("begin-demo clears a pending lastProposal so a rerun can't leak", () => {
  const ran = reducer(initialState, { type: "begin-demo" });
  assert.equal(ran.lastProposal, null, "fresh demo run starts with no re-runnable proposal");
});

test("clear-all preserves the mandate history but resets the session", () => {
  const v2 = reducer(initialState, { type: "set-policy", policy: changedPolicy() });
  const cleared = reducer(v2, { type: "clear-all" });
  assert.equal(cleared.policyHistory.length, 1, "history survives a reset");
  assert.equal(cleared.policy.version, v2.policy.version, "policy survives a reset");
  assert.equal(cleared.events.length, 0);
});

// ---- book aggregation ----

test("computeBook counts entry notional for buys and reduces it on sells", () => {
  const exec = (partial: object) => ({
    id: "x", seq: 0, ts: "t", actor: "Nova", summary: "s", tone: "ok" as const,
    mode: "demo" as const, source: "simulated" as const, event: "executed" as const,
    ...partial,
  });
  const book = computeBook([
    exec({ action: { id: "1", actor: "Nova", goal: "g", kind: "trade", market: "spot", symbol: "BTC", side: "buy", notionalUsd: 100, estRiskUsd: 10, reason: "r", createdAt: "t" } }),
    exec({ action: { id: "2", actor: "Nova", goal: "g", kind: "trade", market: "spot", symbol: "BTC", side: "buy", notionalUsd: 50, estRiskUsd: 10, reason: "r", createdAt: "t" } }),
    exec({ action: { id: "3", actor: "Nova", goal: "g", kind: "trade", market: "spot", symbol: "BTC", side: "sell", notionalUsd: 30, estRiskUsd: 10, reason: "r", createdAt: "t" } }),
  ] as never);
  assert.equal(book.exposureUsd, 120);
  assert.equal(book.positions?.BTC, 120);
  assert.equal(book.ordersToday, 3);
  assert.equal(book.dailyNotionalUsd, 150, "only buys add to daily buy notional");
});

// ---- pending queue drives "Needs approval" + the lab lock ----

/** A policy-decision row that passed but is waiting on the human gate. */
function awaitingDecision(id: string) {
  return {
    id,
    seq: 0,
    ts: "t",
    event: "policy-decision" as const,
    actor: "Nova",
    summary: "passes policy",
    tone: "pending" as const,
    mode: "demo" as const,
    source: "simulated" as const,
    action: {
      id: `a-${id}`,
      actor: "Nova",
      goal: "g",
      kind: "trade" as const,
      market: "spot" as const,
      symbol: "BTC",
      side: "buy" as const,
      notionalUsd: 100,
      estRiskUsd: 10,
      reason: "r",
      createdAt: "t",
    },
    verdict: "approved" as const,
    requiresApproval: true,
    approvalState: "awaiting" as const,
    sentToBroker: false,
    policyVersion: 1,
  };
}

function withOneAwaiting(status: "awaiting-approval" | "stopped") {
  let s = reducer(initialState, { type: "append", events: [awaitingDecision("a")] });
  return reducer(s, { type: "set-status", status });
}

test("resolve-approval on the last pending row drops the agent to idle (never stuck)", () => {
  const parked = withOneAwaiting("awaiting-approval");
  assert.equal(pendingApprovals(parked.events).length, 1);
  const done = reducer(parked, {
    type: "resolve-approval",
    eventId: "a",
    result: "approved",
    followup: [],
  });
  assert.equal(pendingApprovals(done.events).length, 0, "the row pops off the pending queue");
  assert.equal(done.status, "idle", "emptying the queue must return the agent to idle");
  assert.equal(done.events.find((e) => e.id === "a")?.approvalState, "approved");
});

test("resolve-approval keeps the agent parked while other rows still await", () => {
  let s = reducer(initialState, {
    type: "append",
    events: [awaitingDecision("a"), awaitingDecision("b")],
  });
  s = reducer(s, { type: "set-status", status: "awaiting-approval" });
  const done = reducer(s, {
    type: "resolve-approval",
    eventId: "a",
    result: "approved",
    followup: [],
  });
  assert.equal(pendingApprovals(done.events).length, 1);
  assert.equal(done.status, "awaiting-approval");
});

test("resolve-approval never lifts an emergency stop", () => {
  const stopped = withOneAwaiting("stopped");
  const done = reducer(stopped, {
    type: "resolve-approval",
    eventId: "a",
    result: "approved",
    followup: [],
  });
  assert.equal(pendingApprovals(done.events).length, 0);
  assert.equal(done.status, "stopped");
});

test("hydrate parks the agent when a persisted feed still has an awaiting approval", () => {
  const h = reducer(initialState, { type: "hydrate", patch: { events: [awaitingDecision("a")] } });
  assert.equal(pendingApprovals(h.events).length, 1);
  assert.equal(h.status, "awaiting-approval");
});

test("hydrate with no pending work lands idle", () => {
  const h = reducer(initialState, { type: "hydrate", patch: { events: [] } });
  assert.equal(h.status, "idle");
});

test("clear-all wipes the pending queue too", () => {
  const parked = withOneAwaiting("awaiting-approval");
  const cleared = reducer(parked, { type: "clear-all" });
  assert.equal(pendingApprovals(cleared.events).length, 0);
  assert.equal(cleared.status, "idle");
});

