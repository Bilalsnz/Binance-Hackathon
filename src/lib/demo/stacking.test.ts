import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planStack } from "./stacking";
import { makePolicy } from "@/lib/engine/defaults";
import type { GuardContext } from "@/lib/engine/types";

const emptyBook: GuardContext = { exposureUsd: 0, positions: {}, ordersToday: 0, dailyNotionalUsd: 0 };

describe("planStack — drip replay against the real engine", () => {
  it("stops the drip at the position cap (4th $40 order → $160 > $150)", () => {
    const plan = planStack(makePolicy({ maxPositionUsd: 150 }), emptyBook, { perOrderUsd: 40 });
    assert.equal(plan.firstBlocked?.order, 4);
    assert.equal(plan.firstBlockedRule, "position-size");
    assert.equal(plan.wouldHoldUsd, 120); // three $40 drips were allowed first
    assert.equal(plan.steps.length, 4);
    // The first three drips are individually fine; the guard only trips on the
    // cumulative position — the whole point of the demo.
    for (const step of plan.steps.slice(0, 3)) {
      assert.equal(step.decision.state, "approved");
    }
    assert.equal(plan.firstBlocked!.decision.state, "blocked");
  });

  it("already-held same-asset exposure means the very next drip is refused", () => {
    const start: GuardContext = { ...emptyBook, exposureUsd: 120, positions: { BTC: 120 } };
    const plan = planStack(makePolicy({ maxPositionUsd: 150 }), start, { perOrderUsd: 40 });
    assert.equal(plan.firstBlocked?.order, 1);
    assert.equal(plan.firstBlockedRule, "position-size");
  });

  it("a much larger cap moves the stop later (position cap, not the aggregate caps)", () => {
    const plan = planStack(
      makePolicy({ maxPositionUsd: 500, maxCapitalUsd: 2000, maxSingleAssetUsd: 1000, maxDailyNotionalUsd: 2000, maxOrdersPerDay: 100 }),
      emptyBook,
      { perOrderUsd: 40 }
    );
    // 12 × $40 = $480 allowed → the 13th would reach $520 > $500.
    assert.equal(plan.firstBlocked?.order, 13);
    assert.equal(plan.firstBlockedRule, "position-size");
    assert.equal(plan.wouldHoldUsd, 480);
  });

  it("existing exposure in other assets does not change where BTC is stopped", () => {
    const start: GuardContext = { ...emptyBook, exposureUsd: 300, positions: { ETH: 300 } };
    const plan = planStack(makePolicy({ maxPositionUsd: 150 }), start, { perOrderUsd: 40 });
    assert.equal(plan.firstBlocked?.order, 4); // BTC starts at 0 regardless of ETH
    assert.equal(plan.firstBlockedRule, "position-size");
  });
});
