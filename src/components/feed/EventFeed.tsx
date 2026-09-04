"use client";

import type { AuditEvent } from "@/lib/engine/types";
import { DecisionCard } from "@/components/decision/DecisionCard";
import { cn, toneText } from "@/components/ui";
import { clock } from "./time";
import type { Tone } from "@/lib/engine/types";
import {
  CheckCircle2,
  Info,
  Power,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";

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

/**
 * The audit feed. Policy decisions render as full Decision Cards; everything
 * else as compact rows. Pass events already in display order.
 */
export function EventFeed({
  events,
  dense = false,
}: {
  events: AuditEvent[];
  dense?: boolean;
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
          className={cn("animate-slide-in py-1", e.event === "policy-decision" && "py-3")}
        >
          {e.event === "policy-decision" && !dense ? (
            <DecisionCard event={e} />
          ) : (
            <FeedRow event={e} dense={dense} />
          )}
        </li>
      ))}
    </ul>
  );
}
