"use client";

import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import type { AuditEvent } from "@/lib/engine/types";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { SectionTitle, ToneBadge } from "@/components/ui";
import { dayClock } from "@/components/feed/time";

/** The most recent decisions, newest first. */
export function RecentDecisions() {
  const { state } = useAgentGuard();
  const decisions = state.events
    .filter((e) => e.event === "policy-decision")
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 3);

  return (
    <section>
      <div className="row justify-between">
        <SectionTitle icon={<History className="h-4 w-4" />} hint="All decisions are logged">
          Recent decisions
        </SectionTitle>
        <Link href="/app/audit" className="row mb-3 gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          All <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {decisions.length === 0 ? (
        <div className="card card-pad text-sm muted">
          No decisions yet — press <span className="font-semibold text-slate-300">Run the 60-second demo</span>{" "}
          and watch the guard work.
        </div>
      ) : (
        <ul className="card card-pad grid divide-y divide-white/[0.05]">
          {decisions.map((e) => (
            <DecisionRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DecisionRow({ e }: { e: AuditEvent }) {
  const ok = e.verdict === "approved";
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-200">{e.summary}</p>
        <p className="mt-0.5 text-[11px] muted">
          {dayClock(e.ts)} · {e.action?.symbol}
        </p>
      </div>
      <ToneBadge tone={ok ? "ok" : "critical"} className="shrink-0">
        {ok ? "Approved" : "Blocked"}
      </ToneBadge>
    </li>
  );
}
