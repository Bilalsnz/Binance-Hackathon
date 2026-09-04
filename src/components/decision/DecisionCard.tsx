"use client";

import { Check, Minus, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { AuditEvent, PolicyCheck } from "@/lib/engine/types";
import { ruleLabelOf } from "@/lib/engine/policy";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { Btn, cn, ToneBadge } from "@/components/ui";
import { approveLabel, describeAction } from "@/lib/store/events";

function CheckRow({ c }: { c: PolicyCheck }) {
  return (
    <li className="row items-start gap-2.5 text-[13px] leading-snug">
      <span
        className={cn(
          "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full",
          c.passed ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
        )}
      >
        {c.passed ? <Check className="h-3 w-3" strokeWidth={3} /> : <Minus className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        <span className={cn("font-semibold", c.passed ? "text-slate-200" : "text-rose-200")}>
          {ruleLabelOf(c.rule)}
        </span>
        <span className={cn("block", c.passed ? "muted" : "text-rose-300/90")}>{c.detail}</span>
      </span>
    </li>
  );
}

/**
 * The Decision Card — the single most important surface in AgentGuard.
 * Shows the proposed action, every policy check, and the verdict with the
 * exact reason. If the action needs a human, it renders Approve / Decline.
 */
export function DecisionCard({ event, embed = false }: { event: AuditEvent; embed?: boolean }) {
  const { approve, reject } = useAgentGuard();
  const action = event.action;
  if (!action) return null;

  const verdict = event.verdict;
  const awaiting = verdict === "approved" && event.requiresApproval && event.approvalState === "awaiting";
  const blocked = verdict === "blocked";

  const frame = blocked
    ? "from-rose-500/70 via-rose-400/40 to-orange-400/30"
    : awaiting
      ? "from-amber-400/80 via-amber-300/40 to-orange-400/30"
      : "from-emerald-400/80 via-cyan-400/40 to-teal-300/30";

  const Icon = blocked ? ShieldAlert : awaiting ? ShieldQuestion : ShieldCheck;
  const badge = blocked ? (
    <ToneBadge tone="critical">Blocked</ToneBadge>
  ) : awaiting ? (
    <ToneBadge tone="pending">Needs your OK</ToneBadge>
  ) : (
    <ToneBadge tone="ok">Approved</ToneBadge>
  );

  const passed = event.checks?.filter((c) => c.passed).length ?? 0;
  const total = event.checks?.length ?? 0;

  return (
    <div className={cn("rounded-2xl bg-gradient-to-b p-px shadow-card", frame)}>
      <div className="rounded-[calc(1rem-1px)] bg-ink-900/95 p-4">
        {/* Header */}
        <div className="row justify-between">
          {badge}
          <span className="text-[11px] muted">{event.action?.actor ?? "Agent"} · {new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        {/* Action headline */}
        <div className="mt-3 flex items-center gap-3">
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
              blocked
                ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/25"
                : awaiting
                  ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25"
                  : "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25"
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={2.1} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold tracking-tight text-white">
              {describeAction(action)}
            </div>
            <div className="row flex-wrap gap-x-2 text-xs muted">
              <span>{action.goal}</span>
              {action.market === "futures" ? <span className="chip chip-violet !py-0">futures</span> : null}
              {action.kind === "withdraw" ? <span className="chip chip-critical !py-0">withdrawal</span> : null}
            </div>
          </div>
        </div>

        {/* Reason */}
        <p className="mt-3 border-l-2 border-white/10 pl-3 text-[13px] italic leading-relaxed text-slate-400">
          “{action.reason}”
        </p>

        {/* Checks */}
        {event.checks && event.checks.length > 0 ? (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-ink-950/60 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="label">Policy checks</span>
              <span className={cn("font-bold", blocked ? "text-rose-300" : "text-emerald-300")}>
                {passed}/{total} passed
              </span>
            </div>
            <ul className="grid gap-2">
              {event.checks.map((c, i) => (
                <CheckRow key={`${event.id}-${i}`} c={c} />
              ))}
            </ul>
          </div>
        ) : null}

        {/* Verdict banner */}
        {blocked && event.reason ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-[13px] text-rose-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span>
              <span className="font-semibold">Denied by your policy. </span>
              <span className="font-bold text-rose-100">
                {ruleLabelOf(event.checks?.find((c) => !c.passed)?.rule ?? "capital")}:
              </span>{" "}
              {event.reason}
            </span>
          </div>
        ) : null}

        {awaiting ? (
          <div className="mt-4">
            <div className="divider mb-3" />
            <div className="row justify-between gap-2">
              <div className="flex items-center gap-2 text-xs muted">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                You are the guard.
              </div>
              <div className="row gap-2">
                <Btn variant="outline-danger" onClick={() => reject(event.id)}>
                  Decline
                </Btn>
                <Btn variant="ok" onClick={() => approve(event.id)}>
                  Approve {approveLabel(action)}
                </Btn>
              </div>
            </div>
          </div>
        ) : null}

        {!embed && !blocked && !awaiting && event.verdict === "approved" ? (
          <p className="mt-3 text-[11px] muted">Sent to the demo broker · simulated fill, no real money moves.</p>
        ) : null}
      </div>
    </div>
  );
}
