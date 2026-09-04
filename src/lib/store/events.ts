import type {
  AuditEvent,
  Decision,
  ProposedAction,
  Tone,
} from "@/lib/engine/types";
import { blockedReason, formatUsd } from "@/lib/engine/policy";

/** Small uid that works without a secure context (http:// on a phone). */
export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Compact human description of a proposed action, e.g. "Buy $100 BTC on spot". */
export function describeAction(action: ProposedAction): string {
  const verb = action.side === "buy" ? "Buy" : "Sell";
  const kind =
    action.kind === "withdraw" ? "withdrawal" : action.market === "futures" ? "futures trade" : action.market;
  const amount = formatUsd(action.notionalUsd);
  return `${verb} ${amount} ${action.symbol} (${kind})`;
}

/** One-line feed summary for a policy verdict. */
export function summarizeDecision(
  action: ProposedAction,
  decision: Decision
): string {
  const what = describeAction(action);
  if (decision.state === "approved") {
    return decision.requiresApproval
      ? `${action.actor} proposes ${what} — passes policy`
      : `Approved ${what}`;
  }
  return `Blocked ${what} — ${blockedReason(decision)}`;
}

/** Short imperative label for the decision card / approvals list. */
export function approveLabel(action: ProposedAction): string {
  return `${action.side === "buy" ? "Buy" : "Sell"} ${action.symbol} · ${formatUsd(
    action.notionalUsd
  )}`;
}

export interface EventSeed {
  event: AuditEvent["event"];
  summary: string;
  tone: Tone;
  actor?: string;
  detail?: string;
  action?: ProposedAction;
  checks?: AuditEvent["checks"];
  verdict?: AuditEvent["verdict"];
  requiresApproval?: boolean;
  approvalState?: AuditEvent["approvalState"];
  reason?: string;
  mode?: "demo" | "live";
  source?: AuditEvent["source"];
}

/** Build a fully-stamped audit event (id + ts). Seq is assigned by the store. */
export function mkEvent(seed: EventSeed): AuditEvent {
  return {
    id: uid(),
    ts: isoNow(),
    actor: seed.actor ?? "AgentGuard",
    mode: seed.mode ?? "demo",
    source: seed.source ?? "simulated",
    event: seed.event,
    summary: seed.summary,
    tone: seed.tone,
    detail: seed.detail,
    action: seed.action,
    checks: seed.checks,
    verdict: seed.verdict,
    requiresApproval: seed.requiresApproval,
    approvalState: seed.approvalState,
    reason: seed.reason,
    seq: 0,
  };
}
