"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  Bot,
  CheckCircle2,
  Gauge,
  OctagonX,
  Play,
  RotateCcw,
} from "lucide-react";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { AGENT_NAME } from "@/lib/demo/script";
import { agentStatusMeta, Btn, Card, cn, ToneBadge } from "@/components/ui";

const RUNNING = ["running", "researching", "proposing"];

/**
 * The Home hero. Everything on it is a real control:
 *  · the big CTA starts (or resumes) the 60-second judge flow — and when the
 *    Live view is on, it becomes a one-tap "switch to Demo & run" instead of a
 *    dead button;
 *  · Nova's identity opens the Agent feed;
 *  · Exposure / Blocked / Executed open the relevant filtered Audit view.
 * Every state (idle, mid-run, awaiting approval, emergency stop, live) has an
 * explicit control + caption — nothing sits there looking disabled.
 */
export function AgentPanel() {
  const {
    state,
    exposureUsd,
    runDemo,
    resume,
    stopAgent,
    resetDemo,
    pending,
    setMode,
  } = useAgentGuard();

  const status = state.status;
  const meta = agentStatusMeta(status);
  const live = state.mode === "live";
  const hasRun = state.events.length > 0;
  const running = RUNNING.includes(status);

  const blocked = state.events.filter(
    (e) => e.event === "policy-decision" && e.verdict === "blocked"
  ).length;
  const executed = state.events.filter((e) => e.event === "executed").length;

  // Run-like actions always land in Demo Mode; switching modes is never a trap.
  const runInDemo = (fn: () => void) => () => {
    if (state.mode !== "demo") {
      setMode("demo");
      window.setTimeout(() => fn(), 80);
    } else {
      fn();
    }
  };
  const startFresh = runInDemo(runDemo);
  const resumeAgent = runInDemo(resume);
  const resumeScript =
    status === "idle" && hasRun && state.scripted && !state.scriptDone && state.scriptIndex > 0;

  const idleRunLabel = status === "idle" && hasRun ? (resumeScript ? "Resume the demo" : "Run the 60-second demo") : "Run the 60-second demo";
  const primaryRun = resumeScript ? resumeAgent : startFresh;

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-white/[0.06] to-transparent p-4">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />

        {/* Nova — identity row opens the Agent feed */}
        <Link
          href="/app/agent"
          aria-label={`Open ${AGENT_NAME}'s activity feed`}
          className="pressable group row justify-between rounded-2xl px-1 py-1"
        >
          <div className="row min-w-0 gap-3">
            <div className="relative">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 shadow-glow">
                <Bot className="h-6 w-6 text-ink-950" strokeWidth={2.2} />
              </span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-ink-950 ${meta.dot}`}
              />
            </div>
            <div className="min-w-0">
              <p className="row gap-1 font-display text-lg font-bold leading-none text-white">
                {AGENT_NAME}
                <ArrowUpRight className="h-4 w-4 text-cyan-300 opacity-0 transition group-hover:opacity-100" />
              </p>
              <p className="mt-1 text-[11px] muted">Tap to open the live agent feed</p>
            </div>
          </div>
          <ToneBadge tone={meta.tone}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot.replace(" animate-pulse", "")}`} />
            {meta.label}
          </ToneBadge>
        </Link>

        {/* Stats — each opens the relevant audit view */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile
            href="/app/audit?filter=activity"
            label="Exposure"
            value={`$${exposureUsd.toLocaleString()}`}
            icon={<Gauge className="h-4 w-4" />}
            accent="text-cyan-300"
          />
          <StatTile
            href="/app/audit?filter=blocked"
            label="Blocked"
            value={String(blocked)}
            icon={<Ban className="h-4 w-4" />}
            accent="text-rose-300"
          />
          <StatTile
            href="/app/audit?filter=activity"
            label="Executed"
            value={String(executed)}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="text-emerald-300"
          />
        </div>

        <div className="divider my-4" />

        {/* ---- Primary control area ---- */}
        {status === "stopped" ? (
          <div className="grid gap-2">
            <div className="row gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <OctagonX className="h-4 w-4 shrink-0 text-rose-300" />
              Emergency stop engaged — the agent is frozen. Resume to continue or start over.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={startFresh}>
                <RotateCcw className="h-4 w-4" /> Start over
              </Btn>
              <Btn onClick={resumeAgent}>
                <Play className="h-4 w-4 fill-current" /> Resume agent
              </Btn>
            </div>
          </div>
        ) : status === "awaiting-approval" ? (
          <div className="grid gap-2">
            <p className="row gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-300 text-ink-950">
                <span className="h-1 w-1 rounded-full bg-ink-950" />
              </span>
              {AGENT_NAME} is holding at your sign-off. Approve or decline to continue.
            </p>
            <Link href="/app/approvals" className="btn btn-primary w-full !py-3 text-base">
              Review {pending.length} pending approval{pending.length === 1 ? "" : "s"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : running ? (
          <div className="grid gap-2">
            <div className="row justify-between gap-2">
              <p className="row gap-2 text-xs font-medium text-cyan-200">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                </span>
                {AGENT_NAME} is {meta.label.toLowerCase()}…
              </p>
              <Btn variant="danger" onClick={stopAgent} className="!px-3 !py-1.5 text-xs">
                Stop
              </Btn>
            </div>
            <Link href="/app/agent" className="btn btn-ghost w-full">
              Watch the live decision feed <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : live ? (
          <div className="grid gap-2">
            <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
              Live view is reference-only — Mandate never connects from the web and never places
              a live order. Flip back to Demo to replay the judge flow.
            </p>
            <Btn className="w-full !py-3 text-base" onClick={primaryRun}>
              <Play className="h-4 w-4 fill-current" /> Switch to Demo & run the demo
            </Btn>
          </div>
        ) : (
          <div className="grid gap-2">
            <Btn className="w-full !py-3.5 text-[15px]" onClick={primaryRun}>
              <Play className="h-5 w-5 fill-current" /> {idleRunLabel}
            </Btn>
            {hasRun ? (
              <div className="row items-start justify-between gap-2">
                <p className="flex-1 text-[11px] leading-relaxed muted">
                  {state.scriptDone
                    ? "Run finished. Tweak the policy and replay to see the guard change its mind."
                    : resumeScript
                      ? "Continues the paused run from where it stopped."
                    : "Clears the trail, then runs the full 60-second script — every verdict from scratch."}
                </p>
                <button
                  type="button"
                  onClick={resetDemo}
                  className="row shrink-0 gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-white/[0.05] hover:text-white active:scale-95"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

function StatTile({
  href,
  label,
  value,
  icon,
  accent,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value} — open the matching audit view`}
      className="pressable group grid gap-0.5 rounded-xl bg-white/[0.04] py-2 text-center ring-1 ring-transparent hover:bg-white/[0.08] hover:ring-white/10"
    >
      <span className={cn("row justify-center", accent)}>{icon}</span>
      <span className="font-display text-lg font-bold leading-tight text-white">{value}</span>
      <span className="row justify-center text-[9px] uppercase tracking-widest text-slate-500">
        {label}
        <ArrowUpRight className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-100" />
      </span>
    </Link>
  );
}
