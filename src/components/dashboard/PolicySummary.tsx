"use client";

import Link from "next/link";
import { ArrowUpRight, Shield } from "lucide-react";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { formatUsd } from "@/lib/engine/policy";
import { cn, ToneBadge } from "@/components/ui";

/**
 * A compact read-only view of the active mandate. The WHOLE card is one link
 * to the policy editor — tapping anywhere opens the builder, not just "Edit".
 */
export function PolicySummary() {
  const { state, exposureUsd } = useAgentGuard();
  const p = state.policy;
  const buyPower = Math.max(0, p.maxCapitalUsd - exposureUsd);

  const rows: Array<{ label: string; value: string; bad?: boolean }> = [
    { label: "Capital ceiling", value: formatUsd(p.maxCapitalUsd) },
    { label: "Buying power left", value: formatUsd(buyPower), bad: buyPower <= 0 },
    { label: "Max position", value: formatUsd(p.maxPositionUsd) },
    { label: "Max loss / trade", value: formatUsd(p.maxLossPerTradeUsd) },
  ];

  return (
    <Link
      href="/app/policy"
      aria-label="Edit the active mandate in the policy builder"
      className="pressable group card card-pad block hover:border-cyan-400/30 hover:bg-white/[0.06]"
    >
      <div className="row justify-between">
        <div className="row gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/25">
            <Shield className="h-4 w-4" />
          </span>
          <div>
            <p className="row gap-1.5 text-sm font-semibold text-white">
              Active mandate
              <ArrowUpRight className="h-3.5 w-3.5 text-cyan-300 opacity-0 transition group-hover:opacity-100" />
            </p>
            <p className="text-[11px] muted">“{p.name}” · tap to edit</p>
          </div>
        </div>
        <span className="row gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs font-semibold text-slate-200">
          Edit
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-white/[0.04] px-3 py-2">
            <div className={cn("font-display text-base font-bold", r.bad ? "text-rose-300" : "text-white")}>
              {r.value}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{r.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] muted">Allowed:</span>
        {p.allowedAssets.map((a) => (
          <span key={a} className="chip chip-ok">{a}</span>
        ))}
        {!p.allowFutures ? <ToneBadge tone="critical">spot only</ToneBadge> : null}
        {!p.allowWithdrawals ? <ToneBadge tone="critical">no withdrawals</ToneBadge> : null}
        {p.requireApproval ? <ToneBadge tone="pending">approval required</ToneBadge> : null}
      </div>
    </Link>
  );
}
