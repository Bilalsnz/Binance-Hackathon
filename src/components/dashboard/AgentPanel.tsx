"use client";

import Link from "next/link";
import { Bot, OctagonX, Play, RotateCcw } from "lucide-react";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { AGENT_NAME } from "@/lib/demo/script";
import { agentStatusMeta, Btn, Card, ToneBadge } from "@/components/ui";

/** Agent identity + state + the master Run / Resume / Stop controls. */
export function AgentPanel() {
  const { state, exposureUsd, runDemo, resume, stopAgent, resetDemo, pending } = useAgentGuard();
  const status = state.status;
  const meta = agentStatusMeta(status);
  const live = state.mode === "live";
  const hasRun = state.events.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-white/[0.06] to-transparent p-4">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="row justify-between">
          <div className="row gap-3">
            <div className="relative">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 shadow-glow">
                <Bot className="h-6 w-6 text-ink-950" strokeWidth={2.2} />
              </span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-ink-950 ${meta.dot}`}
              />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none text-white">{AGENT_NAME}</p>
              <p className="mt-1 text-[11px] muted">Market agent · Binance Agent OS</p>
            </div>
          </div>
          <ToneBadge tone={meta.tone}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot.replace(" animate-pulse", "")}`} />
            {meta.label}
          </ToneBadge>
        </div>

        <div className="divider my-4" />

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { k: "Exposure", v: `$${exposureUsd.toLocaleString()}` },
            { k: "Blocked", v: String(state.events.filter((e) => e.event === "policy-decision" && e.verdict === "blocked").length) },
            { k: "Executed", v: String(state.events.filter((e) => e.event === "executed").length) },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-white/[0.04] py-2">
              <div className="font-display text-lg font-bold text-white">{s.v}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {status === "stopped" ? (
            <>
              <div className="row gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                <OctagonX className="h-4 w-4 shrink-0 text-rose-300" />
                Emergency stop engaged. The agent is frozen mid-flight.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="danger" onClick={stopAgent}>Stop</Btn>
                <Btn onClick={resume}>Resume</Btn>
              </div>
            </>
          ) : status === "awaiting-approval" ? (
            <Link href="/app/approvals" className="btn btn-ghost w-full">
              Review {pending.length} pending approval{pending.length === 1 ? "" : "s"} →
            </Link>
          ) : live ? (
            <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200">
              Live view is on — the simulated demo is paused. Switch back to Demo to replay the
              judge flow.
            </p>
          ) : !hasRun ? (
            <Btn className="w-full !py-3 text-base" onClick={runDemo}>
              <Play className="h-4 w-4 fill-current" /> Run the 60-second demo
            </Btn>
          ) : status === "idle" ? (
            <>
              <Btn className="w-full" onClick={runDemo}>
                <Play className="h-4 w-4 fill-current" /> {state.scriptDone ? "Replay the demo" : "Resume the demo"}
              </Btn>
              <Btn variant="ghost" onClick={resetDemo}>
                <RotateCcw className="h-4 w-4" /> Clear audit trail
              </Btn>
            </>
          ) : (
            <>
              <Btn className="w-full" variant="danger" onClick={stopAgent}>Stop agent</Btn>
              <p className="text-center text-[11px] muted">
                Watch the live feed on the Agent tab.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
