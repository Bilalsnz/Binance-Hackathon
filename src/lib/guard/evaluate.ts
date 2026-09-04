import { evaluateAction } from "@/lib/engine/policy";
import { normalizePolicy } from "@/lib/engine/defaults";
import { normalizeToolCall } from "@/lib/engine/normalize";
import type {
  ActionKind,
  Decision,
  DecisionState,
  GuardContext,
  Market,
  NormalizedCall,
  Policy,
  ProposedAction,
  RuleId,
  Side,
} from "@/lib/engine/types";

/**
 * The Guard HTTP contract — one honest, server-safe evaluation of ONE proposed
 * action against ONE policy and ONE book. This is the seam a desktop Binance
 * Agent OS agent calls BEFORE executing the underlying Binance tool:
 *
 *   const g = await fetch("…/api/guard/evaluate", { method: "POST", body })  → JSON
 *   if (!g.ok) throw new Error(`blocked by AgentGuard: ${g.reason}`)
 *   // only NOW invoke the real Binance MCP tool
 *
 * The route never holds keys, never connects to Binance and never executes
 * anything: it returns an allow/refuse verdict and the desktop agent (or its
 * operator) is the one who must honour it. That boundary is documented in
 * ARCHITECTURE.md and is exactly as strong as the code path that calls it.
 *
 * "Bring your own book": aggregate rules (daily-loss, concentration, order
 * rate, daily notional) are only enforced against the context the caller sends
 * — a caller that omits it gets `{ exposureUsd: 0 }` and a response that says
 * which rules it lacked data for (see `warnings`).
 */

/** What the caller proposes. `kind`/`market` default to trade/spot. */
export interface GuardActionInput {
  symbol: string;
  side: Side;
  notionalUsd: number;
  kind?: ActionKind;
  market?: Market;
  estRiskUsd?: number;
  /** Agent's goal / the raw instruction it was acting on (for the audit). */
  goal?: string;
  actor?: string;
}

export interface GuardEvaluateRequest {
  /** Full mandate, or a partial one (missing fields take DEFAULT_POLICY). */
  policy: Partial<Policy>;
  action: GuardActionInput;
  /** The caller's broker book. Aggregate rules need it. */
  context?: Partial<GuardContext>;
}

export interface GuardEvaluateOk {
  /** true → approved (send it); false → refused (never reach the broker). */
  ok: boolean;
  state: DecisionState;
  decision: Decision;
  /** Rule ids that fired (empty when approved). */
  blockingRules: RuleId[];
  /** Short single-sentence refusal reason ("" when approved). */
  reason: string;
  /** The normalized tool-call payload recorded as evidence. */
  payload: NormalizedCall;
  policyVersion: number;
  /** Which aggregate rules had no book data, so were not enforced. */
  warnings: string[];
}

export type GuardEvaluateResponse =
  | ({ valid: true } & GuardEvaluateOk)
  | { valid: false; error: string };

function isSide(v: unknown): v is Side {
  return v === "buy" || v === "sell";
}
function isKind(v: unknown): v is ActionKind {
  return v === "trade" || v === "transfer" || v === "withdraw";
}
function isMarket(v: unknown): v is Market {
  return v === "spot" || v === "futures";
}

/** Validate + coerce a request into the engine's shape, or an error string. */
export function guardRequestToAction(
  req: GuardEvaluateRequest
): { action: ProposedAction } | { error: string } {
  const a = req?.action;
  if (!a || typeof a !== "object") return { error: "body.action is required" };
  if (typeof a.symbol !== "string" || !a.symbol.trim())
    return { error: "action.symbol must be a non-empty string" };
  if (!isSide(a.side)) return { error: "action.side must be 'buy' or 'sell'" };
  if (a.kind !== undefined && !isKind(a.kind))
    return { error: "action.kind must be 'trade' | 'transfer' | 'withdraw'" };
  if (a.market !== undefined && !isMarket(a.market))
    return { error: "action.market must be 'spot' | 'futures'" };
  const notional = Number(a.notionalUsd);
  if (!Number.isFinite(notional) || notional <= 0)
    return { error: "action.notionalUsd must be a finite number > 0" };
  const risk = a.estRiskUsd === undefined ? 0 : Number(a.estRiskUsd);
  if (!Number.isFinite(risk) || risk < 0)
    return { error: "action.estRiskUsd must be a finite number >= 0" };

  const kind = a.kind ?? "trade";
  const market = a.market ?? "spot";
  const action: ProposedAction = {
    id: `guard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    actor: a.actor?.trim() || "agent",
    goal: a.goal?.trim() || (kind === "withdraw" ? "Withdraw funds" : "Trade"),
    kind,
    market,
    symbol: a.symbol.trim().toUpperCase(),
    side: a.side,
    notionalUsd: notional,
    estRiskUsd: risk,
    reason: `Guard API evaluation of ${notional} ${a.symbol} ${a.side}`,
  };
  return { action };
}

export function evaluateGuardRequest(
  req: GuardEvaluateRequest
): GuardEvaluateResponse {
  if (!req || typeof req !== "object") return { valid: false, error: "JSON body required" };
  if (!req.policy || typeof req.policy !== "object")
    return { valid: false, error: "body.policy is required" };

  const built = guardRequestToAction(req);
  if ("error" in built) return { valid: false, error: built.error };

  const action = built.action;
  const policy = normalizePolicy(req.policy);

  const ctx: GuardContext = { exposureUsd: 0, ...(req.context ?? {}) };
  const warnings: string[] = [];
  if (ctx.positions === undefined)
    warnings.push("no positions book → per-asset concentration not enforced");
  if (ctx.realizedLossTodayUsd === undefined)
    warnings.push("no realized-loss book → daily-loss halt not enforced");
  if (ctx.ordersToday === undefined)
    warnings.push("no order-count book → order-rate not enforced");
  if (ctx.dailyNotionalUsd === undefined)
    warnings.push("no daily-notional book → aggregate buy cap not enforced");

  const decision = evaluateAction(policy, action, ctx);
  const payload = normalizeToolCall(action);
  const blockingRules = decision.blockedBy.map((c) => c.rule);
  const reason =
    decision.blockedBy.map((c) => `${c.rule}: ${c.detail}`).join("; ") || "";

  return {
    valid: true,
    ok: decision.state === "approved",
    state: decision.state,
    decision,
    blockingRules,
    reason,
    payload,
    policyVersion: policy.version,
    warnings,
  };
}
