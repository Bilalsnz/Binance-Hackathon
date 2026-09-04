"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Ban, ShieldCheck, ShieldQuestion, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { ruleLabelOf } from "@/lib/engine/policy";
import { previewScenario, SCENARIOS, scenarioAction, type Scenario, type ScenarioPreview } from "@/lib/demo/scenarios";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { cn, SectionTitle, Spinner } from "@/components/ui";

/**
 * The dashboard's "Try a scenario" deck. Each card runs ONE proposal through
 * the real policy engine the moment it is tapped, then routes the judge to the
 * right place: an approval that needs their OK → Approvals; anything else → the
 * decision feed on the Agent page. Cards are disabled (with the reason shown,
 * never silently) while a run is in flight or the mode/status forbids it.
 */
export function ScenarioDeck() {
  const router = useRouter();
  const { state, exposureUsd, playScenario } = useAgentGuard();
  const [busy, setBusy] = useState<string | null>(null);

  // Live preview of what today's policy would say — recomputed on every edit.
  const previews = useMemo(() => {
    const map = new Map<string, ScenarioPreview>();
    for (const sc of SCENARIOS) {
      map.set(sc.id, previewScenario(state.policy, exposureUsd, sc));
    }
    return map;
  }, [state.policy, exposureUsd]);

  const running = ["running", "researching", "proposing"].includes(state.status);
  const lock =
    state.mode !== "demo"
      ? "Live view is reference-only — switch to Demo to play a scenario."
      : running
        ? "The demo is mid-run — let it finish or Stop it, then try a scenario."
        : state.status === "awaiting-approval"
          ? "Approve or decline the pending action first."
          : state.status === "stopped"
            ? "Emergency stop is engaged — Resume the agent first."
            : null;

  const fire = async (sc: Scenario) => {
    if (lock || busy) return;
    setBusy(sc.id);
    const outcome = await playScenario(sc.id);
    setBusy(null);
    if (!outcome) return;
    // Needs your OK → the Approvals screen holds the Approve/Decline buttons.
    if (outcome.verdict === "needs-ok") {
      router.push("/app/approvals");
    } else {
      router.push("/app/agent");
    }
  };

  return (
    <section>
      <SectionTitle icon={<Sparkles className="h-4 w-4 text-violet-300" />} hint="real engine · no preset verdicts">
        Try a scenario
      </SectionTitle>
      {lock ? (
        <p className="mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          {lock}
        </p>
      ) : (
        <p className="mb-2 text-xs muted">
          Tap one to watch the guard rule it right now — approved actions pause for your OK, blocked
          ones show the exact reason.
        </p>
      )}

      <div className="grid gap-2">
        {SCENARIOS.map((sc) => (
          <ScenarioCard
            key={sc.id}
            sc={sc}
            preview={previews.get(sc.id)!}
            disabled={!!lock || busy !== null}
            busy={busy === sc.id}
            onTap={() => fire(sc)}
          />
        ))}
      </div>
    </section>
  );
}

type Verdict = "ok" | "needs-ok" | "blocked";

/** Single-source-of-truth styling per preview verdict — no nested ternaries. */
const VERDICT_STYLE: Record<
  Verdict,
  { card: string; tile: string; sub: string; icon: ReactNode }
> = {
  blocked: {
    card: "border-rose-400/20 bg-rose-500/[0.05] hover:border-rose-400/40 hover:bg-rose-500/[0.1]",
    tile: "bg-rose-500/15 text-rose-300 ring-rose-400/25",
    sub: "text-rose-300/90",
    icon: <Ban className="h-5 w-5" />,
  },
  "needs-ok": {
    card: "border-amber-400/25 bg-amber-400/[0.06] hover:border-amber-400/45 hover:bg-amber-400/[0.12]",
    tile: "bg-amber-400/15 text-amber-300 ring-amber-400/25",
    sub: "text-amber-200/90",
    icon: <ShieldQuestion className="h-5 w-5" />,
  },
  ok: {
    card: "border-emerald-400/20 bg-emerald-400/[0.05] hover:border-emerald-400/40 hover:bg-emerald-400/[0.1]",
    tile: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25",
    sub: "text-emerald-200/90",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
};

function ScenarioCard({
  sc,
  preview,
  disabled,
  busy,
  onTap,
}: {
  sc: Scenario;
  preview: ScenarioPreview;
  disabled: boolean;
  busy: boolean;
  onTap: () => void;
}) {
  const action = scenarioAction(sc);
  const verdict: Verdict = preview.ok ? (preview.needsApproval ? "needs-ok" : "ok") : "blocked";
  const vs = VERDICT_STYLE[verdict];
  const subtitle = busy
    ? null
    : preview.ok
      ? preview.needsApproval
        ? "Approves — pauses for your OK."
        : "Approves automatically."
      : `${preview.rule ? ruleLabelOf(preview.rule) + " — " : ""}${preview.reason ?? "blocked"}`;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-busy={busy}
      className={cn(
        "pressable group row w-full items-center gap-3 rounded-2xl border p-3 text-left",
        vs.card,
        disabled && "cursor-not-allowed opacity-60 active:scale-100"
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ring-1",
          vs.tile
        )}
      >
        {action.symbol.slice(0, 3)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="row items-center gap-1.5">
          <span className="block text-sm font-bold text-white">{sc.title}</span>
          {disabled && !busy ? (
            <span className="rounded bg-white/[0.05] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              locked
            </span>
          ) : null}
        </span>
        <span className={cn("mt-0.5 block text-xs leading-snug", vs.sub)}>
          {busy ? (
            <span className="row gap-1.5">
              <Spinner className="h-3 w-3" /> Checking against your policy…
            </span>
          ) : (
            subtitle
          )}
        </span>
      </span>

      <span className="row shrink-0 items-center gap-1.5">
        {busy ? null : vs.icon}
        {!busy && !disabled ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-current opacity-0 transition group-hover:opacity-100" />
        ) : null}
      </span>
    </button>
  );
}
