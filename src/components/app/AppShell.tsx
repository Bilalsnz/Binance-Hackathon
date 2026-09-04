"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Cable,
  FlaskConical,
  History,
  LayoutDashboard,
  Power,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { AgentGuardProvider, useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { cn } from "@/components/ui";

const NAV = [
  { href: "/app", label: "Home", icon: LayoutDashboard },
  { href: "/app/agent", label: "Agent", icon: Bot },
  { href: "/app/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/app/policy", label: "Policy", icon: SlidersHorizontal },
  { href: "/app/audit", label: "Audit", icon: History },
] as const;

function Brand() {
  return (
    <Link href="/app" className="row gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 shadow-glow">
        <Shield className="h-[18px] w-[18px] text-ink-950" strokeWidth={2.6} />
      </span>
      <span className="h-display text-[17px] text-white">
        Agent<span className="text-gradient">Guard</span>
      </span>
    </Link>
  );
}

function EmergencyStop() {
  const { stopAgent } = useAgentGuard();
  return (
    <button
      type="button"
      onClick={stopAgent}
      title="Emergency stop — pause the agent"
      aria-label="Emergency stop"
      className="grid h-9 w-9 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/30 active:scale-95"
    >
      <Power className="h-4 w-4" />
    </button>
  );
}

function ModeToggle() {
  const { state, setMode } = useAgentGuard();
  const demo = state.mode === "demo";
  return (
    <div
      role="group"
      aria-label="App mode — Demo or Live"
      className="flex rounded-xl border border-white/10 bg-white/[0.05] p-0.5 text-[11px] font-bold uppercase tracking-wide"
    >
      <button
        type="button"
        aria-pressed={demo}
        onClick={() => setMode("demo")}
        title="Demo Mode — simulated broker, nothing real moves"
        className={cn(
          "row gap-1.5 rounded-[10px] px-2.5 py-1.5 transition active:scale-95",
          demo
            ? "bg-gradient-to-r from-cyan-400 to-cyan-500 text-ink-950 shadow"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
        )}
      >
        <FlaskConical className={cn("h-3.5 w-3.5", !demo && "opacity-50")} />
        Demo
      </button>
      <button
        type="button"
        aria-pressed={!demo}
        onClick={() => setMode("live")}
        title="Live view — reference only; AgentGuard never connects from the web"
        className={cn(
          "row gap-1.5 rounded-[10px] px-2.5 py-1.5 transition active:scale-95",
          !demo
            ? "bg-gradient-to-r from-amber-400 to-orange-500 text-ink-950 shadow"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
        )}
      >
        <Cable className={cn("h-3.5 w-3.5", demo && "opacity-50")} />
        Live
      </button>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between px-4">
        <Brand />
        <div className="row gap-2">
          <ModeToggle />
          <EmergencyStop />
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { state } = useAgentGuard();
  const approvalPing = state.events.some(
    (e) => e.event === "policy-decision" && e.requiresApproval && e.approvalState === "awaiting"
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/90 backdrop-blur-xl">
      <div
        className="mx-auto grid w-full max-w-xl grid-cols-5"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10px] font-semibold transition",
                active ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <span className="relative">
                <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.4 : 2} />
                {label === "Approvals" && approvalPing ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                ) : null}
              </span>
              {label}
              {active ? (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Content is never gated on hydration: children render immediately (they are
 * part of the static HTML too), so a slow or failing client effect can never
 * leave the app frozen on a loading screen. An error boundary keeps any render
 * failure visible and recoverable instead of blank.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-5">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgentGuardProvider>
      <Shell>{children}</Shell>
    </AgentGuardProvider>
  );
}
