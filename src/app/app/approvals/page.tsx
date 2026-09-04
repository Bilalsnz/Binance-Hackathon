"use client";

import Link from "next/link";
import { ArrowRight, History, ShieldCheck } from "lucide-react";
import { DecisionCard } from "@/components/decision/DecisionCard";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";

export default function ApprovalsPage() {
  const { state, pending, runDemo, setMode } = useAgentGuard();
  const live = state.mode === "live";

  // Running the judge demo is a Demo-Mode act — never silently run it as "live".
  const startDemo = () => {
    if (live) {
      setMode("demo");
      window.setTimeout(() => runDemo(), 80);
    } else {
      runDemo();
    }
  };

  return (
    <div className="grid gap-4">
      <header>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="h-display text-2xl text-white">Approvals</h1>
            {pending.length > 0 ? (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-ink-950">
                {pending.length}
              </span>
            ) : null}
          </div>
          <Link
            href="/app/audit"
            className="row gap-1 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
            <History className="h-3.5 w-3.5" /> Audit trail
          </Link>
        </div>
        <p className="mt-1 text-sm muted">
          Every approved action stops here first. You are the guard — nothing moves without you.
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              {state.events.length === 0 ? "You're in the clear" : "All decisions handled"}
            </p>
            <p className="mx-auto mt-1 max-w-[36ch] text-xs muted">
              {state.events.length === 0
                ? "When the agent proposes an action that fits your policy and your mandate requires approval, the decision lands here for your sign-off."
                : "Every action needing your OK has been reviewed. Decisions you approved or declined are timestamped in the audit trail."}
            </p>
          </div>
          {state.events.length === 0 ? (
            <div className="grid gap-1.5">
              {live ? (
                <p className="text-[11px] text-amber-200/80">
                  Switching to Demo Mode to run the judge flow — Live view never runs the demo.
                </p>
              ) : null}
              <button type="button" onClick={startDemo} className="btn btn-primary mt-1">
                Run the demo to see one <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link href="/app/audit" className="btn btn-ghost mt-1">
              View the audit trail <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-xs muted">
            Reviewed decisions are logged to your audit trail with a timestamp, result and reason.
          </p>
          {pending.map((e) => (
            <DecisionCard key={e.id} event={e} embed />
          ))}
        </div>
      )}
    </div>
  );
}
