"use client";

import { Ban, CheckCircle2, Hourglass } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * "Tool-call gateway" strip — renders the would-be tool call that AgentGuard
 * sits in front of, with the guard's verdict on it.
 *
 *   agent intent → [ GUARD ] → broker / exchange
 *
 * The call line is generic (method = kind, then symbol/side/notional/market) —
 * the exact shape an Agent OS MCP agent would send onward. We deliberately do
 * NOT print a fake official tool name; the normalized payload above is the
 * evidence. The demo broker is always labelled simulated; deny/hold rows state
 * plainly that nothing was sent.
 */

type GateState = "deny" | "hold" | "exec";

const THEME: Record<
  GateState,
  { border: string; bg: string; badge: string; note: string; Icon: typeof Ban }
> = {
  deny: {
    border: "border-rose-400/30",
    bg: "bg-rose-500/[0.06]",
    badge: "bg-rose-500/15 text-rose-300",
    note: "text-rose-200/90",
    Icon: Ban,
  },
  hold: {
    border: "border-amber-400/30",
    bg: "bg-amber-400/[0.06]",
    badge: "bg-amber-400/15 text-amber-300",
    note: "text-amber-200/90",
    Icon: Hourglass,
  },
  exec: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-400/[0.06]",
    badge: "bg-emerald-400/15 text-emerald-300",
    note: "text-emerald-200/90",
    Icon: CheckCircle2,
  },
};

const BADGE: Record<GateState, string> = {
  deny: "DENY",
  hold: "HOLD",
  exec: "EXEC · demo",
};

export function ToolGate({
  state,
  call,
  note,
}: {
  state: GateState;
  /** The would-be tool call, e.g. `trade(BTC, buy, $4,000, spot)`. */
  call: string;
  note: string;
}) {
  const t = THEME[state];
  const { Icon } = t;
  return (
    <div className={cn("mt-3 overflow-hidden rounded-xl border", t.border, t.bg)}>
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          AgentGuard tool-call gateway
        </span>
        <span
          className={cn(
            "row gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide",
            t.badge
          )}
        >
          <Icon className="h-3 w-3" strokeWidth={3} /> {BADGE[state]}
        </span>
      </div>
      <pre className="mt-1.5 overflow-x-auto whitespace-pre px-3 pb-1 font-mono text-[11px] leading-snug text-slate-200">
        agent intent → guard → broker · <span className="text-slate-400">{call}</span>
      </pre>
      <p className={cn("px-3 pb-2.5 text-[11px] leading-relaxed", t.note)}>{note}</p>
    </div>
  );
}

/** Build the call line from a normalized payload. */
export function toolCallLine(p: {
  kind: string;
  symbol: string;
  side: string;
  notionalUsd: number;
  market: string;
}): string {
  const method = p.kind === "withdraw" ? "withdraw" : p.kind === "transfer" ? "transfer" : "trade";
  const usd = `$${Math.round(p.notionalUsd).toLocaleString("en-US")}`;
  return `${method}(${p.symbol}, ${p.side}, ${usd}, ${p.market})`;
}
