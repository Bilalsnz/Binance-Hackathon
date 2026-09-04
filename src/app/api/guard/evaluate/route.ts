import { NextResponse } from "next/server";
import { evaluateGuardRequest, type GuardEvaluateRequest } from "@/lib/guard/evaluate";

/**
 * POST /api/guard/evaluate
 *
 * Evaluate ONE proposed action against ONE policy + book and answer allow /
 * refuse. This route is the honest interception seam for a real Binance Agent
 * OS agent: call it BEFORE the underlying Binance tool executes, and gate the
 * tool call on the response.
 *
 * It never holds keys, never connects to Binance and never executes anything.
 * See ARCHITECTURE.md §"where AgentGuard sits" for the exact boundary.
 *
 * Body:
 *   { policy, action: {symbol, side, notionalUsd, kind?, market?, estRiskUsd?, goal?, actor?}, context? }
 *
 * 200 → { valid: true, ok, state, decision, blockingRules, reason, payload, policyVersion, warnings }
 * 400 → { valid: false, error }
 */
export async function POST(req: Request) {
  let body: GuardEvaluateRequest;
  try {
    body = (await req.json()) as GuardEvaluateRequest;
  } catch {
    return NextResponse.json({ valid: false, error: "invalid JSON body" }, { status: 400 });
  }
  const result = evaluateGuardRequest(body);
  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
