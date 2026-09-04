"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Coins,
  FlaskConical,
  Landmark,
  Percent,
  RotateCcw,
  Shield,
  ShieldOff,
  ShieldQuestion,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Policy } from "@/lib/engine/types";
import { DEFAULT_POLICY } from "@/lib/engine/defaults";
import { formatUsd, ruleLabelOf } from "@/lib/engine/policy";
import { previewScenario, SCENARIOS } from "@/lib/demo/scenarios";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { describeAction } from "@/lib/store/events";
import { Btn, Card, cn, Switch, ToneBadge } from "@/components/ui";

const ASSET_OPTIONS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "LINK"];

const PRESETS: Array<{ label: string; desc: string; policy: Partial<Policy> }> = [
  {
    label: "Guardian",
    desc: "BTC+ETH · $150 pos · spot only",
    policy: {},
  },
  {
    label: "Conservative",
    desc: "BTC only · tiny caps · no derivatives",
    policy: {
      name: "Conservative vault",
      maxCapitalUsd: 150,
      allowedAssets: ["BTC"],
      maxPositionUsd: 60,
      maxLossPerTradeUsd: 8,
      allowFutures: false,
      allowWithdrawals: false,
      requireApproval: true,
    },
  },
  {
    label: "Max freedom",
    desc: "Many assets · big caps · auto-approve",
    policy: {
      name: "Hands-on mandate",
      maxCapitalUsd: 2000,
      allowedAssets: ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"],
      maxPositionUsd: 500,
      maxLossPerTradeUsd: 120,
      allowFutures: true,
      allowWithdrawals: false,
      requireApproval: false,
    },
  },
];

function posture(policy: Policy): { label: string; tone: "ok" | "pending" | "critical" | "info" } {
  const strict =
    policy.allowedAssets.length <= 3 &&
    policy.maxPositionUsd <= 200 &&
    policy.requireApproval &&
    !policy.allowFutures;
  const relaxed =
    policy.allowedAssets.length >= 5 && policy.maxPositionUsd >= 400 && !policy.requireApproval;
  if (relaxed) return { label: "Relaxed", tone: "pending" };
  if (strict) return { label: "Strict", tone: "ok" };
  return { label: "Balanced", tone: "info" };
}

export function PolicyBuilder() {
  const router = useRouter();
  const { state, book, setPolicy, setMode, exposureUsd, rerunLastProposal } = useAgentGuard();
  const [draft, setDraft] = useState<Policy>(state.policy);
  const [saved, setSaved] = useState(false);
  const [rerunWanted, setRerunWanted] = useState(false);

  // "Edit the mandate & re-run this exact action" lands here via ?rerun=1.
  // Read the URL once on mount (never write back) so no Suspense boundary is
  // needed around useSearchParams during prerender.
  useEffect(() => {
    setRerunWanted(new URLSearchParams(window.location.search).get("rerun") === "1");
  }, []);

  const post = posture(draft);
  const buyingPower = Math.max(0, draft.maxCapitalUsd - exposureUsd);
  const set = (patch: Partial<Policy>) => setDraft((d) => ({ ...d, ...patch }));
  const rerunTarget = state.lastProposal?.action ?? null;
  const isRerunMode = rerunWanted && !!rerunTarget;

  const toggleAsset = (a: string) =>
    set({
      allowedAssets: draft.allowedAssets.includes(a)
        ? draft.allowedAssets.filter((x) => x !== a)
        : [...draft.allowedAssets, a],
    });

  const save = async () => {
    setPolicy({ ...draft, updatedAt: new Date().toISOString() });
    setSaved(true);
    if (!isRerunMode) {
      window.setTimeout(() => setSaved(false), 1600);
      return;
    }
    // Mid-run proof: after the mandate saves, re-run the SAME proposal against
    // the new version. Any verdict flip comes from the rules — not a script.
    if (state.mode !== "demo") {
      setMode("demo");
      await new Promise((r) => window.setTimeout(r, 150));
    }
    const outcome = await rerunLastProposal();
    window.setTimeout(() => {
      router.push(outcome && outcome.verdict === "needs-ok" ? "/app/approvals" : "/app/agent");
    }, 650);
  };

  const stats = useMemo(
    () => [
      { icon: Landmark, label: "Capital ceiling", key: "maxCapitalUsd", max: 2000, step: 50 },
      { icon: TrendingUp, label: "Max position / trade", key: "maxPositionUsd", max: 600, step: 10 },
      { icon: Percent, label: "Max loss / trade", key: "maxLossPerTradeUsd", max: 200, step: 5 },
    ] as const,
    []
  );

  return (
    <div className="grid gap-4 pb-4">
      {/* Presets */}
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setDraft({ ...DEFAULT_POLICY, ...p.policy, updatedAt: draft.updatedAt })}
            className="card card-pad !p-3 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.07]"
          >
            <div className="text-sm font-bold text-white">{p.label}</div>
            <div className="mt-0.5 text-[10px] leading-snug muted">{p.desc}</div>
          </button>
        ))}
      </div>

      {/* Re-test mode — banner shown when a judge arrived via "re-run this action" */}
      {rerunWanted ? (
        <Card className="card-pad border-cyan-400/25 bg-cyan-400/[0.05]">
          {rerunTarget ? (
            <>
              <div className="row gap-2 text-sm font-semibold text-cyan-200">
                <FlaskConical className="h-4 w-4 text-cyan-300" />
                Re-test mode — this proposal is queued to re-run on Save
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                After you save, Mandate bumps the policy version and re-runs{" "}
                <span className="font-semibold text-white">{describeAction(rerunTarget)}</span>{" "}
                against it. Same action, same engine, different rules — the verdict is the proof.
              </p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-slate-300">
              Re-test mode is on, but there is no proposal queued yet. Run one from Home (composer
              or a scenario), then come back — the exact action will re-run after you save.
            </p>
          )}
        </Card>
      ) : null}

      {/* Identity + posture */}
      <Card className="card-pad">
        <div className="row justify-between">
          <p className="label">Mandate</p>
          <ToneBadge tone={post.tone}>Posture · {post.label}</ToneBadge>
        </div>
        <input
          className="field mt-2 font-display text-base font-semibold"
          value={draft.name}
          maxLength={40}
          onChange={(e) => set({ name: e.target.value })}
          aria-label="Mandate name"
        />
      </Card>

      {/* Allowed assets */}
      <Card className="card-pad">
        <div className="row gap-2">
          <Coins className="h-4 w-4 text-cyan-300" />
          <p className="label flex-1">Allowed assets</p>
          {draft.allowedAssets.length === 0 ? (
            <ToneBadge tone="critical">blocks all trades</ToneBadge>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ASSET_OPTIONS.map((a) => {
            const on = draft.allowedAssets.includes(a);
            return (
              <button
                key={a}
                onClick={() => toggleAsset(a)}
                aria-pressed={on}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-bold transition active:scale-95",
                  on
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-ink-950 shadow"
                    : "border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Limits */}
      <Card className="card-pad">
        <div className="row gap-2">
          <Wallet className="h-4 w-4 text-cyan-300" />
          <p className="label">Limits (USD)</p>
        </div>
        <div className="mt-3 grid gap-4">
          {stats.map(({ icon: Icon, label, key, max, step }) => (
            <div key={key}>
              <div className="row justify-between text-sm">
                <span className="row gap-1.5 text-slate-300">
                  <Icon className="h-4 w-4 text-slate-500" /> {label}
                </span>
                <span className="mono font-bold text-white">{formatUsd(draft[key])}</span>
              </div>
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={max}
                step={step}
                value={draft[key]}
                onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<Policy>)}
                aria-label={label}
              />
            </div>
          ))}
        </div>
        <div className="divider my-4" />
        <div className="flex justify-between text-xs">
          <span className="muted">Exposure now</span>
          <span className="mono font-bold text-slate-300">{formatUsd(exposureUsd)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <span className="muted">Buying power left</span>
          <span className={cn("mono font-bold", buyingPower <= 0 ? "text-rose-300" : "text-emerald-300")}>
            {formatUsd(buyingPower)}
          </span>
        </div>
      </Card>

      {/* Permissions */}
      <Card className="card-pad grid gap-3">
        <div className="row gap-2">
          <Shield className="h-4 w-4 text-cyan-300" />
          <p className="label">Permissions</p>
        </div>
        <Switch
          accent="cyan"
          checked={draft.allowFutures}
          onChange={(v) => set({ allowFutures: v })}
          label={
            <span className="flex items-center gap-2">
              Derivatives (futures)
              {!draft.allowFutures ? <span className="chip chip-critical">spot only</span> : null}
            </span>
          }
        />
        <div className="divider" />
        <Switch
          accent="rose"
          checked={draft.allowWithdrawals}
          onChange={(v) => set({ allowWithdrawals: v })}
          label={
            <span className="flex items-center gap-2">
              Withdrawals allowed
              {draft.allowWithdrawals ? (
                <ToneBadge tone="critical">high risk</ToneBadge>
              ) : (
                <span className="chip chip-ok">locked</span>
              )}
            </span>
          }
        />
        <div className="divider" />
        <Switch
          accent="amber"
          checked={draft.requireApproval}
          onChange={(v) => set({ requireApproval: v })}
          label={
            <span className="flex items-center gap-2">
              Human approval per action
              {draft.requireApproval ? (
                <ShieldQuestion className="h-4 w-4 text-amber-300" />
              ) : (
                <ShieldOff className="h-4 w-4 text-slate-500" />
              )}
            </span>
          }
        />
      </Card>

      {/* How the draft would rule each scenario — live, recomputed on every edit */}
      <Card className="card-pad">
        <div className="row justify-between">
          <p className="label">Guard&apos;s verdict on each scenario</p>
          <ToneBadge tone={post.tone}>draft · {post.label}</ToneBadge>
        </div>
        <p className="mt-1 text-xs muted">
          Re-runs the five demo proposals through your draft above — change a slider and watch the
          verdicts move. Not enforced until you press Save.
        </p>
        <ul className="mt-3 grid divide-y divide-white/[0.05]">
          {SCENARIOS.map((sc) => {
            const pv = previewScenario(draft, book, sc);
            return (
              <li key={sc.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white">{sc.title}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-snug",
                      pv.ok ? "text-emerald-300/80" : "text-rose-300/90"
                    )}
                  >
                    {pv.ok
                      ? pv.needsApproval
                        ? "Approves — pauses for your OK."
                        : "Approves automatically."
                      : `${ruleLabelOf(pv.rule!)} — ${pv.reason}`}
                  </p>
                </div>
                <ToneBadge
                  tone={pv.ok ? (pv.needsApproval ? "pending" : "ok") : "critical"}
                  className="shrink-0"
                >
                  {pv.ok ? (pv.needsApproval ? "Needs your OK" : "Approved") : "Blocked"}
                </ToneBadge>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Summary + save */}
      <div className="sticky bottom-24 z-10">
        <Card className="card-pad !bg-ink-900/95 backdrop-blur-xl">
          <div className="row flex-wrap gap-1.5 text-[11px]">
            <span className="muted">Rule preview:</span>
            {draft.allowedAssets.slice(0, 4).map((a) => (
              <span key={a} className="chip chip-ok">{a}</span>
            ))}
            {draft.allowedAssets.length > 4 ? <span className="chip chip-plain">+{draft.allowedAssets.length - 4}</span> : null}
            <span className="chip chip-info">≤ {formatUsd(draft.maxPositionUsd)} pos</span>
            <span className="chip chip-info">risk ≤ {formatUsd(draft.maxLossPerTradeUsd)}</span>
            {draft.allowFutures ? <span className="chip chip-violet">futures</span> : <span className="chip chip-plain">spot</span>}
          </div>
          <div className="row mt-3 justify-between gap-2">
            <Btn
              variant="ghost"
              onClick={() => setDraft({ ...DEFAULT_POLICY, updatedAt: draft.updatedAt })}
            >
              <RotateCcw className="h-4 w-4" /> Defaults
            </Btn>
            <Btn onClick={save} className="flex-1" disabled={draft.allowedAssets.length === 0}>
              {saved ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={3} /> {isRerunMode ? "Re-running the action…" : "Mandate live"}
                </>
              ) : isRerunMode ? (
                <>
                  <FlaskConical className="h-4 w-4" /> Save &amp; re-run the action
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" /> Save &amp; enforce mandate
                </>
              )}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
