"use client";

import { Cable, CheckCircle2, FlaskConical, ShieldCheck, Unplug, XCircle } from "lucide-react";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { Card, cn, ToneBadge } from "@/components/ui";

/**
 * How Mandate is wired right now. In Demo Mode this is the simulated
 * broker; in the Live view it shows the honest Binance Agent OS picture:
 * a *reference* status (never faked as connected from the web), the scoped
 * permissions Binance actually grants an agent, and Mandate's own
 * enforcement row. The research feed source is always labelled too.
 */
export function ConnectionCard() {
  const { state } = useAgentGuard();
  const live = state.mode === "live";
  const feedLive = state.snapshot?.source === "live";

  return (
    <Card className="card-pad">
      <div className="row justify-between">
        <p className="label mb-3">Exchange connection</p>
        {live ? <ToneBadge tone="warn">live view</ToneBadge> : <ToneBadge tone="ok">demo</ToneBadge>}
      </div>

      {/* Status block */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-3",
          live
            ? "border-amber-400/25 bg-amber-400/[0.07]"
            : "border-emerald-400/25 bg-emerald-400/[0.07]"
        )}
      >
        {live ? (
          <Unplug className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        ) : (
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        )}
        <div className="min-w-0 text-[13px] leading-relaxed">
          {live ? (
            <>
              <p className="row gap-2 font-semibold text-amber-200">
                Binance Agent OS
                <span className="row items-center gap-1 text-[11px] font-normal text-rose-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Not connected from the web
                </span>
              </p>
              <p className="text-amber-200/70">
                Mandate is a policy layer — it never holds your keys and never places a live
                order itself. A real Agent OS connection lives on your desktop, inside your own MCP
                client, scoped to your Agentic sub-account. This view never fakes one.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-emerald-200">Demo broker — simulated</p>
              <p className="text-emerald-200/70">
                Zero deposits, zero real orders. Every execution below is a clearly-labelled
                simulation so judges can test the full flow safely — no Binance account needed.
              </p>
            </>
          )}
        </div>
      </div>

      {/* What Binance grants an Agent OS agent — reference model, never a live claim */}
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-ink-950/50 p-3">
        <div className="row justify-between text-[11px]">
          <span className="label">Permissions Binance grants an Agent OS agent</span>
          {live ? (
            <span className="text-[10px] text-slate-500">reference · your desktop</span>
          ) : null}
        </div>
        <ul className="mt-2 grid gap-1.5 text-xs">
          <li className="row gap-2 text-slate-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>Market data — public, no key required</span>
          </li>
          <li className="row gap-2 text-slate-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>
              Account + Trade — spot · margin · convert · USDⓈ-M · COIN-M (Agentic sub-account)
            </span>
          </li>
          <li className="row gap-2 text-slate-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>Transfer — inside your sub-account only</span>
          </li>
          <li className="row gap-2 text-slate-300">
            <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
            <span>
              Withdrawals — no scope exists · Mandate mirrors it with the withdrawal rule
            </span>
          </li>
        </ul>
      </div>

      {/* Mandate's own enforcement */}
      <div className="row gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2.5 text-xs text-cyan-200">
        <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-300" />
        <span>
          Mandate policy enforcement: <span className="font-bold">ACTIVE</span>
          {live ? " — approved actions still need your confirmation inside Agent OS." : " — every demo action is checked against your mandate."}
        </span>
      </div>

      <div className="row gap-2 pt-3 text-xs muted">
        <Cable className="h-4 w-4 text-cyan-300/70" />
        <span>
          Research feed:{" "}
          <span className="font-semibold text-slate-300">
            {feedLive ? "Binance public market data" : "demo quotes (simulated)"}
          </span>
          {state.snapshot
            ? ` · updated ${new Date(state.snapshot.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : " · fetching…"}
        </span>
      </div>
    </Card>
  );
}
