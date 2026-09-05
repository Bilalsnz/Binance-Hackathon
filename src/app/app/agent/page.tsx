"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Play, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { EventFeed } from "@/components/feed/EventFeed";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { AGENT_NAME, DEMO_SCRIPT } from "@/lib/demo/script";
import { agentStatusMeta, Btn, ToneBadge } from "@/components/ui";

const PIPELINE = ["Research", "Propose", "Policy check", "Approve", "Execute"];

export default function AgentPage() {
  const { state, runDemo, resume, pending, setMode } = useAgentGuard();
  const live = ["researching", "proposing", "running"].includes(state.status);
  // The header badge and pipeline track the pending QUEUE for the approval
  // phase — not the raw status field — so an already-handled approval can
  // never leave the page claiming the agent still needs an OK.
  const awaiting = pending.length > 0;
  const meta = agentStatusMeta(awaiting ? "awaiting-approval" : state.status);
  const endRef = useRef<HTMLDivElement>(null);

  // Chronological feed — keep the newest event in view.
  const asc = [...state.events].sort((a, b) => a.seq - b.seq);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [asc.length, live]);

  const idleWithFeed = state.status === "idle" && state.events.length > 0;
  const canResume = idleWithFeed && state.scripted && !state.scriptDone && state.scriptIndex > 0;

  // The judge flow is a Demo-Mode act; never silently run it from Live view.
  const runInDemo = (fn: () => void) => () => {
    if (state.mode !== "demo") {
      setMode("demo");
      window.setTimeout(() => fn(), 80);
    } else {
      fn();
    }
  };
  const startFresh = runInDemo(runDemo);

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
          className="pressable row justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200"
        >
          {pending.length} decision{pending.length > 1 ? "s" : ""} waiting on you <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}

      {/* Contextual next step when the feed exists but nothing is running */}
      {idleWithFeed && !pending.length ? (
        <div className="card card-pad row flex-wrap justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs muted">
            {state.scriptDone
              ? "Run complete — every proposal above was checked by the real policy engine."
              : canResume
                ? "The demo paused here. Resume to keep marching through the script."
                : "That was a single scenario. Replay the full demo to watch all five proposals."}
          </p>
          <div className="row flex-wrap gap-2">
            <Btn variant="ghost" onClick={canResume ? runInDemo(resume) : startFresh}>
              <RotateCcw className="h-3.5 w-3.5" /> {state.scriptDone ? "Replay demo" : canResume ? "Resume demo" : "Full demo"}
            </Btn>
            <Link href="/app/policy" className="btn btn-ghost !px-3 !py-2 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Tune policy
            </Link>
          </div>
        </div>
      ) : null}

      {/* Pipeline strip — a read-only live indicator, never a control */}
      <div className="card card-pad">
        <p className="label">Agent pipeline · status only</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {(() => {
              const phase =
                state.status === "researching"
                  ? 0
                  : state.status === "proposing"
                    ? 1
                    : awaiting
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
          {state.mode === "live" ? (
            <p className="text-[11px] text-amber-200/80">Switching to Demo Mode to run the judge flow.</p>
          ) : null}
          <Btn onClick={startFresh} className="mt-1">
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
