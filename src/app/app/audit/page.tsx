"use client";

import { useEffect, useMemo, useState } from "react";
import { FileJson, History, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { EventFeed } from "@/components/feed/EventFeed";
import { ReceiptExport } from "@/components/audit/ReceiptExport";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { cn } from "@/components/ui";

type Filter = "all" | "approved" | "blocked" | "activity";

export default function AuditPage() {
  const { state, runDemo, setMode } = useAgentGuard();
  const [filter, setFilter] = useState<Filter>("all");

  // Deep links from the dashboard stats (?filter=blocked etc.) pre-select a
  // filter once on mount — read from the URL only, never written back.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f === "approved" || f === "blocked" || f === "activity" || f === "all") {
      setFilter(f);
    }
  }, []);

  const events = useMemo(() => {
    let list = state.events;
    if (filter === "approved") {
      list = list.filter(
        (e) => e.event === "policy-decision" && e.verdict === "approved"
      );
    } else if (filter === "blocked") {
      list = list.filter(
        (e) => e.event === "policy-decision" && e.verdict === "blocked"
      );
    } else if (filter === "activity") {
      list = list.filter((e) => e.event !== "policy-decision");
    }
    return [...list].sort((a, b) => b.seq - a.seq); // newest first
  }, [state.events, filter]);

  const counts = useMemo(() => {
    const decisions = state.events.filter((e) => e.event === "policy-decision");
    return {
      approved: decisions.filter((d) => d.verdict === "approved").length,
      blocked: decisions.filter((d) => d.verdict === "blocked").length,
    };
  }, [state.events]);

  // action ids that produced a simulated demo fill — lets each audit row show
  // its own execution state even when the executed event is filtered out.
  const executedActionIds = useMemo(
    () =>
      new Set(
        state.events
          .filter((e) => e.event === "executed" && e.action)
          .map((e) => e.action!.id)
      ),
    [state.events]
  );

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All" },
    { id: "approved", label: `Approved · ${counts.approved}` },
    { id: "blocked", label: `Blocked · ${counts.blocked}` },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="grid gap-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="h-display flex items-center gap-2 text-2xl text-white">
            <History className="h-6 w-6 text-cyan-300" /> Audit history
          </h1>
          <p className="mt-1 text-sm muted">
            Every decision is recorded with its action, result, exact reason and timestamp.
          </p>
        </div>
      </header>

      {/* Tamper-evident export */}
      <div className="card card-pad row items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label row gap-1.5">
            <FileJson className="h-3.5 w-3.5 text-cyan-300" /> Export evidence
          </p>
          <p className="mt-1 text-xs leading-relaxed muted">
            Download the full session ledger as a JSON receipt — every action, verdict, reason,
            mandate version and execution state, chained with SHA-256 so any later edit is
            detectable. Generated locally in your browser; it is tamper-evident, not signed or
            notarised.
          </p>
        </div>
        <div className="shrink-0">
          <ReceiptExport />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95",
              filter === f.id
                ? "bg-gradient-to-r from-cyan-400 to-violet-500 text-ink-950 shadow"
                : "border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {state.events.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-700" />
          <p className="text-sm muted">Nothing logged yet. Run the demo to fill the trail.</p>
          <button
            type="button"
            onClick={() => {
              if (state.mode !== "demo") setMode("demo");
              window.setTimeout(() => runDemo(), 80);
            }}
            className="btn btn-primary mt-1"
          >
            <Play className="h-4 w-4 fill-current" /> Run the demo &amp; log decisions
          </button>
        </div>
      ) : (
        <div className="card card-pad">
          <EventFeed events={events} dense executedActionIds={executedActionIds} />
        </div>
      )}

      <p className="row justify-center gap-1.5 text-[11px] muted">
        <ShieldAlert className="h-3.5 w-3.5 text-slate-600" />
        AgentGuard is a policy &amp; safety layer — not financial advice.
      </p>
    </div>
  );
}
