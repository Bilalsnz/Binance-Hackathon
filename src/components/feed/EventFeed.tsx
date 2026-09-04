"use client";

import type { AuditEvent, Tone } from "@/lib/engine/types";
import { DecisionCard } from "@/components/decision/DecisionCard";
import { cn, ToneBadge, toneText } from "@/components/ui";
import { clock } from "./time";
import { intentLabel } from "@/lib/store/events";
import {
  Check,
  CheckCircle2,
  Info,
  Power,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { ruleLabelOf } from "@/lib/engine/policy";
import { toolCallLine } from "@/components/decision/ToolGate";

/** Compact badge for the would-be Agent OS tool call on each audit decision. */
const GATE_BADGE = {
  deny: { label: "DENY", cls: "bg-rose-500/15 text-rose-300" },
  hold: { label: "HOLD", cls: "bg-amber-400/15 text-amber-300" },
  exec: { label: "EXEC · demo", cls: "bg-emerald-400/15 text-emerald-300" },
} as const;

const EVENT_ICON: Partial<Record<AuditEvent["event"], LucideIcon>> = {
  research: Search,
  executed: CheckCircle2,
  approved: ShieldCheck,
  rejected: XCircle,
  "agent-started": Sparkles,
  "emergency-stop": Power,
  "policy-updated": Settings2,
  system: Info,
};

function iconBg(tone: Tone): string {
  switch (tone) {
    case "ok":
      return "bg-emerald-400/10 ring-emerald-400/20";
    case "critical":
      return "bg-rose-400/10 ring-rose-400/20";
    case "pending":
    case "warn":
      return "bg-amber-400/10 ring-amber-400/20";
    default:
      return "bg-cyan-400/10 ring-cyan-400/20";
  }
}

function Meta({ event }: { event: AuditEvent }) {
  return (
    <div className="row flex-wrap gap-x-1.5 text-[11px] muted">
      <span className="font-medium text-slate-500">{event.actor}</span>
      <span>·</span>
      <span>{clock(event.ts)}</span>
      {event.source !== "simulated" ? (
        <>
          <span>·</span>
          <span className="text-cyan-300/80">
            {event.source === "binance-public" ? "Binance public data" : "Agent OS"}
          </span>
        </>
      ) : null}
    </div>
  );
}

/** Compact timeline row for non-decision activity. */
export function FeedRow({ event, dense }: { event: AuditEvent; dense?: boolean }) {
  const Icon = EVENT_ICON[event.event] ?? Info;
  return (
    <div className={cn("row items-start gap-3", dense ? "py-1.5" : "py-2")}>
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1",
          dense ? "h-7 w-7" : "",
          iconBg(event.tone)
        )}
      >
        <Icon className={cn("h-4 w-4", toneText(event.tone))} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("leading-snug", dense ? "text-[13px]" : "text-sm")}>
          <span className={cn("text-slate-100", event.event === "policy-updated" && "font-semibold")}>
            {event.summary}
          </span>
        </p>
        <div className="mt-1">
          <Meta event={event} />
        </div>
        {event.detail ? (
          <p className="mt-1.5 whitespace-pre-line rounded-lg border border-white/[0.06] bg-ink-950/50 px-3 py-2 text-xs leading-relaxed muted">
            {event.detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Audit-page story row for a policy decision. Compact enough for a history
 * list but complete: proposal → verdict chip → exact reason → what the human
 * did → whether a demo fill executed.
 */
function AuditDecision({
  event,
  executed,
}: {
  event: AuditEvent;
  executed: boolean;
}) {
  const action = event.action;
  if (!action) return null;

  const blocked = event.verdict === "blocked";
  const awaiting =
    event.verdict === "approved" && event.requiresApproval && event.approvalState === "awaiting";
  const declined = event.verdict === "approved" && event.approvalState === "rejected";

  // Which way the tool-call gateway swung for this decision (never executed by
  // this row — the demo fill is the only thing that ever sets sentToBroker).
  const gate: "deny" | "hold" | "exec" = blocked
    ? "deny"
    : awaiting
      ? "hold"
      : declined
        ? "deny"
        : event.sentToBroker === true
          ? "exec"
          : "hold";
  const g = GATE_BADGE[gate];

  const chip: { label: string; tone: Tone } = blocked
    ? { label: "Blocked", tone: "critical" }
    : awaiting
      ? { label: "Needs your OK", tone: "pending" }
      : declined
        ? { label: "Declined", tone: "warn" }
        : { label: "Approved", tone: "ok" };

  const Icon = blocked ? ShieldAlert : awaiting ? ShieldQuestion : declined ? XCircle : ShieldCheck;

  return (
    <div className="row items-start gap-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1",
          blocked
            ? "bg-rose-400/10 ring-rose-400/25 text-rose-300"
            : awaiting
              ? "bg-amber-400/10 ring-amber-400/25 text-amber-300"
              : declined
                ? "bg-slate-400/10 ring-slate-400/25 text-slate-300"
                : "bg-emerald-400/10 ring-emerald-400/25 text-emerald-300"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="row items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] font-semibold text-white">
            {action.side === "buy" ? "Buy" : "Sell"} {action.symbol} · $
            {Math.round(action.notionalUsd).toLocaleString("en-US")}
          </p>
          <span className="shrink-0">
            <ToneBadge tone={chip.tone}>{chip.label}</ToneBadge>
          </span>
        </div>

        <div
          className={cn(
            "mt-1 text-xs leading-relaxed",
            blocked
              ? "text-rose-300/90"
              : awaiting
                ? "text-amber-200/90"
                : declined
                  ? "text-slate-400"
                  : "text-emerald-200/90"
          )}
        >
          {blocked
            ? `${event.reason ?? "A policy rule failed."}`
            : awaiting
              ? "Passes every rule — waiting for your OK."
              : declined
                ? "You declined it — nothing was executed."
                : executed
                  ? "Approved · simulated demo fill executed."
                  : "Approved."}
        </div>

        <div className="mt-1">
          <Meta event={event} />
        </div>

        {event.policyVersion !== undefined ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-semibold text-slate-400">
              policy v{event.policyVersion}
            </span>
            <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-slate-500">
              {intentLabel(event.intent)}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-semibold",
                event.sentToBroker === true
                  ? "bg-emerald-400/10 text-emerald-300"
                  : event.verdict === "blocked"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-amber-400/10 text-amber-300"
              )}
            >
              {event.sentToBroker === true
                ? "sent to demo broker"
                : event.verdict === "blocked"
                  ? "never reached a broker"
                  : "not sent yet"}
            </span>
          </div>
        ) : null}

        {event.checks && event.checks.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.07]">
            <div className="flex items-center justify-between gap-2 bg-white/[0.02] px-2.5 py-1.5">
              <span className="mono min-w-0 truncate text-[11px] text-slate-300">
                <span className="text-slate-500">guard → </span>
                {toolCallLine(action)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide",
                  g.cls
                )}
              >
                {g.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.05] px-2.5 py-1.5">
              {event.checks.map((c, i) => (
                <span
                  key={`${event.id}-rule-${i}`}
                  title={c.detail}
                  className={cn(
                    "row items-center gap-1 text-[10px] font-medium",
                    c.passed ? "text-emerald-300/70" : "text-rose-300"
                  )}
                >
                  {c.passed ? (
                    <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
                  ) : (
                    <X className="h-3 w-3 shrink-0" strokeWidth={3} />
                  )}
                  {ruleLabelOf(c.rule)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The audit feed. Policy decisions render as full Decision Cards on the agent
 * screen or as compact story rows on the audit page; everything else renders
 * as compact rows. Pass events already in display order. `executedActionIds`
 * lets the audit story attach execution state to each decision.
 */
export function EventFeed({
  events,
  dense = false,
  executedActionIds,
}: {
  events: AuditEvent[];
  dense?: boolean;
  executedActionIds?: Set<string>;
}) {
  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-sm muted">
        The audit trail is empty. Run the demo to see decisions land here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/[0.05]">
      {events.map((e) => (
        <li
          key={e.id}
          className={cn("animate-slide-in py-1", e.event === "policy-decision" && "py-2.5")}
        >
          {e.event === "policy-decision" && !dense ? (
            <DecisionCard event={e} />
          ) : e.event === "policy-decision" && dense ? (
            <AuditDecision event={e} executed={executedActionIds?.has(e.action?.id ?? "") ?? false} />
          ) : (
            <FeedRow event={e} dense={dense} />
          )}
        </li>
      ))}
    </ul>
  );
}
