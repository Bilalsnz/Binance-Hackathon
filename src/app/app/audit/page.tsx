"use client";

import { useMemo, useState } from "react";
import { History, ShieldAlert, ShieldCheck } from "lucide-react";
import { EventFeed } from "@/components/feed/EventFeed";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { cn } from "@/components/ui";

type Filter = "all" | "approved" | "blocked" | "activity";

export default function AuditPage() {
  const { state } = useAgentGuard();
  const [filter, setFilter] = useState<Filter>("all");

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

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
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
        <div className="card flex items-center justify-center gap-3 p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-700" />
          <p className="text-sm muted">Nothing logged yet. Run the demo to fill the trail.</p>
        </div>
      ) : (
        <div className="card card-pad">
          <EventFeed events={events} dense />
        </div>
      )}

      <p className="row justify-center gap-1.5 text-[11px] muted">
        <ShieldAlert className="h-3.5 w-3.5 text-slate-600" />
        AgentGuard is a policy &amp; safety layer — not financial advice.
      </p>
    </div>
  );
}
