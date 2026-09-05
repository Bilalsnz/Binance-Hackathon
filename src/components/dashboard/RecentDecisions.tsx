"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, History, X } from "lucide-react";
import type { AuditEvent } from "@/lib/engine/types";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { DecisionCard } from "@/components/decision/DecisionCard";
import { SectionTitle, ToneBadge } from "@/components/ui";
import { dayClock } from "@/components/feed/time";

/** The most recent decisions, newest first. Each row opens the full decision. */
export function RecentDecisions() {
  const { state } = useAgentGuard();
  const [open, setOpen] = useState<AuditEvent | null>(null);

  const decisions = state.events
    .filter((e) => e.event === "policy-decision")
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 4);

  return (
    <section>
      <div className="row justify-between">
        <SectionTitle icon={<History className="h-4 w-4" />} hint="Tap a row for the full decision">
          Recent decisions
        </SectionTitle>
        <Link href="/app/audit" className="row mb-3 gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          All <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {decisions.length === 0 ? (
        <div className="card card-pad text-sm muted">
          No decisions yet — press <span className="font-semibold text-slate-300">Run the 60-second demo</span>{" "}
          or tap a scenario above and watch the guard work.
        </div>
      ) : (
        <ul className="card card-pad grid divide-y divide-white/[0.05]">
          {decisions.map((e) => (
            <li key={e.id}>
              <DecisionRow e={e} onOpen={() => setOpen(e)} />
            </li>
          ))}
        </ul>
      )}

      {open ? <DecisionSheet event={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

function DecisionRow({ e, onOpen }: { e: AuditEvent; onOpen: () => void }) {
  const awaiting = e.verdict === "approved" && e.requiresApproval && e.approvalState === "awaiting";
  const declined = e.verdict === "approved" && e.approvalState === "rejected";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the full decision for ${e.summary}`}
      className="pressable group row w-full justify-between gap-3 py-2.5 text-left first:pt-0 last:pb-0"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-200 group-hover:text-white">{e.summary}</p>
        <p className="mt-0.5 text-[11px] muted">
          {dayClock(e.ts)} · {e.action?.symbol}
        </p>
      </div>
      <span className="row shrink-0 gap-1.5">
        <ToneBadge
          tone={e.verdict === "blocked" ? "critical" : awaiting ? "pending" : declined ? "warn" : "ok"}
          className="shrink-0"
        >
          {e.verdict === "blocked" ? "Blocked" : awaiting ? "Needs approval" : declined ? "Declined" : "Approved"}
        </ToneBadge>
        <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:text-cyan-300" />
      </span>
    </button>
  );
}

/** Bottom-sheet view of one decision — proposal, checks, reason, actions. */
function DecisionSheet({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid items-end justify-items-center" role="dialog" aria-modal="true" aria-label="Decision details">
      <button
        type="button"
        aria-label="Close decision details"
        onClick={onClose}
        className="ag-fade-in absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />
      <div className="ag-slide-up relative z-10 max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-900 p-4 shadow-2xl">
        <div className="row justify-between pb-2">
          <p className="label">Decision record</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1] hover:text-white active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <DecisionCard event={event} embed />
        <p className="pt-3 text-center text-[11px] muted">
          Every action, policy result and reason is written to the audit trail.
        </p>
      </div>
    </div>
  );
}
