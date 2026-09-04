"use client";

import { Cable, FlaskConical, Radio } from "lucide-react";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { Card, cn } from "@/components/ui";

/**
 * Shows how AgentGuard is wired right now: the Demo broker (simulated) or the
 * Live view, plus the source of the research feed (live Binance public data
 * vs labelled demo quotes). Honest about what is and isn't real.
 */
export function ConnectionCard() {
  const { state } = useAgentGuard();
  const live = state.mode === "live";
  const feedLive = state.snapshot?.source === "live";

  return (
    <Card className="card-pad">
      <p className="label mb-3">Exchange connection</p>

      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-3",
          live
            ? "border-amber-400/25 bg-amber-400/[0.07]"
            : "border-emerald-400/25 bg-emerald-400/[0.07]"
        )}
      >
        {live ? (
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        ) : (
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        )}
        <div className="min-w-0 text-[13px] leading-relaxed">
          {live ? (
            <>
              <p className="font-semibold text-amber-200">Live view</p>
              <p className="text-amber-200/70">
                AgentGuard is a policy layer, not a broker. Wire your own Binance Agent OS agent
                (desktop + your Agentic sub-account). The web app never holds your keys and never
                places a live order.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-emerald-200">Demo broker — simulated</p>
              <p className="text-emerald-200/70">
                Zero deposits, zero real orders. Every execution below is a clearly-labelled
                simulation so judges can test the full flow safely.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="row gap-2 pt-3 text-xs muted">
        <Cable className="h-4 w-4 text-cyan-300/70" />
        <span>
          Research feed:{" "}
          <span className="font-semibold text-slate-300">
            {feedLive ? "Binance public market data" : "demo quotes (simulated)"}
          </span>
          {state.snapshot ? ` · updated ${new Date(state.snapshot.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : " · fetching…"}
        </span>
      </div>
    </Card>
  );
}
