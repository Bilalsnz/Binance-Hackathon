"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { SCENARIOS, scenarioAction, type Scenario } from "@/lib/demo/scenarios";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { cn, SectionTitle, Spinner } from "@/components/ui";

/**
 * The dashboard's "Try a scenario" deck. Each card runs ONE proposal through
 * the real policy engine the moment it is tapped, then routes the judge to the
 * right place: an approval that needs their OK → Approvals; anything else → the
 * decision feed on the Agent page.
 *
 * Cards deliberately do NOT reveal a verdict before they run — no preview
 * coloring, no "would be blocked" caption. The verdict appears only in the
 * Decision Card after the engine evaluates it, so nothing on the dashboard can
 * read as a scripted answer. Cards are disabled (with the reason shown, never
 * silently) while a run is in flight or the mode/status forbids it.
 */
export function ScenarioDeck() {
  const router = useRouter();
  const { state, pending, propose } = useAgentGuard();
  const [busy, setBusy] = useState<string | null>(null);

  const running = ["running", "researching", "proposing"].includes(state.status);
  const lock =
    state.mode !== "demo"
      ? "Live view is reference-only — switch to Demo to play a scenario."
      : pending.length > 0
        ? "Approve or decline the pending action first."
        : running
          ? "The demo is mid-run — let it finish or Stop it, then try a scenario."
          : state.status === "stopped"
            ? "Emergency stop is engaged — Resume the agent first."
            : null;

  const fire = async (sc: Scenario) => {
    if (lock || busy) return;
    setBusy(sc.id);
    // One action through the real engine — no preset verdict anywhere.
    const outcome = await propose(scenarioAction(sc), { intent: "scenario" });
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
      <SectionTitle icon={<Sparkles className="h-4 w-4 text-violet-300" />} hint="verdict only after the run">
        Try a scenario
      </SectionTitle>
      {lock ? (
        <p className="mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          {lock}
        </p>
      ) : (
        <p className="mb-2 text-xs muted">
          Tap one to send it through the guard — the verdict is the engine&apos;s answer to the{" "}
          <em>current</em> mandate, decided at that moment. No card here predicts it.
        </p>
      )}

      <div className="grid gap-2">
        {SCENARIOS.map((sc) => (
          <ScenarioCard
            key={sc.id}
            sc={sc}
            disabled={!!lock || busy !== null}
            busy={busy === sc.id}
            onTap={() => fire(sc)}
          />
        ))}
      </div>
    </section>
  );
}

function ScenarioCard({
  sc,
  disabled,
  busy,
  onTap,
}: {
  sc: Scenario;
  disabled: boolean;
  busy: boolean;
  onTap: () => void;
}) {
  const action = scenarioAction(sc);
  const verb = action.side === "buy" ? "Buy" : "Sell";
  const line = action.kind === "withdraw"
    ? `Withdraw $${Math.round(action.notionalUsd).toLocaleString("en-US")}`
    : `${verb} $${Math.round(action.notionalUsd).toLocaleString("en-US")} ${action.symbol}${
        action.market === "futures" ? " · futures" : ""
      }`;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-busy={busy}
      className={cn(
        "pressable group row w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition",
        "hover:border-cyan-400/40 hover:bg-white/[0.06]",
        disabled && "cursor-not-allowed opacity-60 active:scale-100"
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] font-display text-sm font-bold text-slate-200 ring-1 ring-white/10">
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
        <span className="mt-0.5 block text-xs leading-snug text-slate-400">
          {busy ? (
            <span className="row gap-1.5">
              <Spinner className="h-3 w-3" /> Checking against your policy…
            </span>
          ) : (
            <span className="mono font-semibold text-slate-300">{line}</span>
          )}
        </span>
      </span>

      <span className="row shrink-0 items-center gap-1.5">
        {busy ? null : (
          <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-300" />
        )}
      </span>
    </button>
  );
}
