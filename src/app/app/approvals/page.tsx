"use client";

import Link from "next/link";
import { ArrowRight, History, ShieldCheck } from "lucide-react";
import { DecisionCard } from "@/components/decision/DecisionCard";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { formatUsd } from "@/lib/engine/policy";

/**
 * Live guard position. Exposure and buying power are derived from the executed
 * events in the book, so every Approve (which appends a demo fill) raises
 * exposure and lowers buying power on the spot; a Decline adds nothing. This is
 * the mandate math, recomputed in real time — not a static display.
 */
function PositionBand() {
  const { state, exposureUsd } = useAgentGuard();
  const p = state.policy;
  const buyPower = Math.max(0, p.maxCapitalUsd - exposureUsd);

  const stats: Array<{ label: string; value: string; bad?: boolean }> = [
    { label: "Exposure", value: formatUsd(exposureUsd), bad: exposureUsd > p.maxCapitalUsd },
    { label: "Buying power left", value: formatUsd(buyPower), bad: buyPower <= 0 },
    { label: "Capital ceiling", value: formatUsd(p.maxCapitalUsd) },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="label !mb-0">Guard position</p>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          recomputed after every approve / decline
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-ink-950/50 px-3 py-2">
            <div className={`font-display text-base font-bold ${s.bad ? "text-rose-300" : "text-white"}`}>
              {s.value}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Approving a buy appends the demo fill to the book — exposure rises, buying power falls, and
        the next proposal is judged against the updated position. Declining adds nothing.
      </p>
    </div>
  );
}

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

      <PositionBand />

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
