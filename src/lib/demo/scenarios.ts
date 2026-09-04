import type {
  GuardContext,
  Policy,
  ProposedAction,
  RuleId,
} from "@/lib/engine/types";
import { evaluateAction } from "@/lib/engine/policy";
import { AGENT_NAME, DEMO_SCRIPT, type DemoScriptStep } from "./script";

/**
 * Quick-launch demo scenarios.
 *
 * Each scenario points at ONE step of the judge script (`DEMO_SCRIPT`), so the
 * numbers and reasons a scenario produces are byte-for-byte the same ones the
 * full 60-second demo produces. Nothing here pre-decides a verdict: playback
 * and previews both run through the real `evaluateAction` engine.
 *
 * Used by three surfaces that must never disagree:
 *   1. the dashboard "Try a scenario" deck,
 *   2. the policy builder's live preview ("how would the guard rule this now?"),
 *   3. unit tests that pin the expected verdict + failing rule per scenario.
 */

export interface Scenario {
  id: string;
  /** Human title for scenario cards, e.g. "Buy $250 BTC". */
  title: string;
  /** Index of this scenario's action step inside `DEMO_SCRIPT`. */
  index: number;
}

export const SCENARIOS: Scenario[] = [
  { id: "buy-100-btc", title: "Buy $100 BTC", index: 1 },
  { id: "scale-250-btc", title: "Buy $250 BTC", index: 2 },
  { id: "sol-80", title: "Buy $80 SOL", index: 3 },
  { id: "btc-futures", title: "Long BTC · futures", index: 5 },
  { id: "withdraw-40", title: "Withdraw $40", index: 6 },
];

function actionStepAt(index: number): Extract<DemoScriptStep, { type: "action" }> {
  const step = DEMO_SCRIPT[index];
  if (!step || step.type !== "action") {
    throw new Error(`scenario ${index} does not point at an action step`);
  }
  return step;
}

/**
 * Build the proposed action a scenario represents. Ids/createdAt are stable
 * placeholders so preview DOM text is identical on server and client; the
 * store stamps real ids/createdAt when it actually plays a scenario.
 */
export function scenarioAction(sc: Scenario): ProposedAction {
  const s = actionStepAt(sc.index);
  return {
    id: `preview-${sc.id}`,
    createdAt: "",
    actor: AGENT_NAME,
    goal: s.goal,
    kind: s.kind,
    market: s.market,
    symbol: s.symbol,
    side: s.side,
    notionalUsd: s.notionalUsd,
    estRiskUsd: s.estRiskUsd,
    reason: s.reason,
  };
}

/** Read-only engine verdict for a scenario under a given policy + book. */
export interface ScenarioPreview {
  ok: boolean;
  needsApproval: boolean;
  /** Failing rule + its exact reason when the scenario is blocked. */
  rule?: RuleId;
  reason?: string;
}

/**
 * Previews run the SAME engine call the store will make, over the same context
 * (the full broker book when one is available, not just exposure) — so the
 * card can never promise a verdict the real run won't deliver.
 */
export function previewScenario(
  policy: Policy,
  ctx: number | GuardContext,
  sc: Scenario
): ScenarioPreview {
  const d = evaluateAction(policy, scenarioAction(sc), ctx);
  if (d.state === "approved") {
    return { ok: true, needsApproval: d.requiresApproval };
  }
  const f = d.blockedBy[0];
  return { ok: false, needsApproval: false, rule: f?.rule, reason: f?.detail };
}

export type ScenarioId = Scenario["id"];

export function scenarioById(id: ScenarioId): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
