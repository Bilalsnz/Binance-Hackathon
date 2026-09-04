import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, reducer } from "./state";

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
