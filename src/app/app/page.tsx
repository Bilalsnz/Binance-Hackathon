"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { ProposalLab } from "@/components/dashboard/ProposalLab";
import { ScenarioDeck } from "@/components/dashboard/ScenarioDeck";
import { PolicySummary } from "@/components/dashboard/PolicySummary";
import { ConnectionCard } from "@/components/dashboard/ConnectionCard";
import { RecentDecisions } from "@/components/dashboard/RecentDecisions";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";

export default function DashboardPage() {
  const { pending } = useAgentGuard();

  return (
    <div className="grid gap-4">
      <header className="pt-1">
        <h1 className="h-display text-2xl text-white">
          Your AI can trade.
          <br />
          <span className="text-gradient">Your rules decide whether it can.</span>
        </h1>
        <p className="mt-1.5 text-sm muted">
          Mandate checks every action your agent proposes against the mandate you set — before
          anything reaches an exchange.
        </p>
      </header>

      {pending.length > 0 ? (
        <Link
          href="/app/approvals"
          className="pressable row gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/15 to-orange-400/10 px-4 py-3 text-sm font-semibold text-amber-200 hover:brightness-110"
        >
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-ink-950">
            {pending.length}
          </span>
          <span className="flex-1">
            {pending.length} action{pending.length > 1 ? "s" : ""} waiting on your approval
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      <AgentPanel />
      <ProposalLab />
      <ScenarioDeck />
      <PolicySummary />
      <ConnectionCard />
      <RecentDecisions />
    </div>
  );
}
