"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { EventFeed } from "@/components/feed/EventFeed";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { AGENT_NAME, DEMO_SCRIPT } from "@/lib/demo/script";
import { agentStatusMeta, Btn, ToneBadge } from "@/components/ui";

const PIPELINE = ["Research", "Propose", "Policy check", "Approve", "Execute"];

export default function AgentPage() {
  const { state, runDemo, pending } = useAgentGuard();
  const live = state.status === "researching" || state.status === "proposing" || state.status === "running";
  const meta = agentStatusMeta(state.status);
  const endRef = useRef<HTMLDivElement>(null);

  // Chronological feed — keep the newest event in view.
  const asc = [...state.events].sort((a, b) => a.seq - b.seq);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [asc.length, live]);

  return (
    <div className="grid gap-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="h-display text-2xl text-white">Agent activity</h1>
          <p className="mt-1 text-sm muted">Watch {AGENT_NAME} research, propose and get checked.</p>
        </div>
        <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
      </header>

      {pending.length > 0 ? (
        <Link
          href="/app/approvals"
          className="row justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200"
        >
          {pending.length} decision{pending.length > 1 ? "s" : ""} waiting on you <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}

      {/* Pipeline strip */}
      <div className="card card-pad">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {(() => {
              const phase =
                state.status === "researching"
                  ? 0
                  : state.status === "proposing"
                    ? 1
                    : state.status === "awaiting-approval"
                      ? 3
                      : state.scriptDone
                        ? 5
                        : -1;
              return PIPELINE.map((step, i) => (
                <span key={step} className="row gap-1">
                  {i > 0 ? <ArrowRight className="h-3 w-3 text-slate-700" /> : null}
                  <span
                    className={
                      phase === i
                        ? "text-cyan-300"
                        : phase > i
                          ? "text-slate-300"
                          : "text-slate-600"
                    }
                  >
                    {step}
                  </span>
                </span>
              ));
            })()}
          </div>
          {state.scriptIndex > 0 && !state.scriptDone ? (
            <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold tabular-nums text-slate-400">
              step {Math.min(state.scriptIndex, DEMO_SCRIPT.length)}/{DEMO_SCRIPT.length}
            </span>
          ) : null}
        </div>
      </div>

      {state.events.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-white/10">
            <Sparkles className="h-6 w-6 text-cyan-300" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">The feed is quiet</p>
            <p className="mx-auto mt-1 max-w-[34ch] text-xs muted">
              Run the demo to watch {AGENT_NAME} research BTC, propose trades, and meet your policy
              — approvals, blocks and all.
            </p>
          </div>
          <Btn onClick={runDemo} className="mt-1">
            <Play className="h-4 w-4 fill-current" /> Start the demo agent
          </Btn>
        </div>
      ) : (
        <div>
          {live ? (
            <div className="row gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs font-medium text-cyan-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
              </span>
              {AGENT_NAME} is {meta.label.toLowerCase()}…
            </div>
          ) : null}

          <EventFeed events={asc} />

          {state.scriptDone ? (
            <p className="mt-2 text-center text-xs muted">
              Demo run complete. Tweak the policy and replay to see the guard change its mind.
            </p>
          ) : null}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
