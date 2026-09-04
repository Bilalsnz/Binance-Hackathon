import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Bot,
  Check,
  ChevronRight,
  CircleCheck,
  FlaskConical,
  History,
  Lock,
  OctagonX,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { n: "01", t: "You set a mandate", d: "Capital, assets, position size, loss, derivatives, withdrawals, approvals." },
  { n: "02", t: "Agent researches", d: "Nova reads market data through a Binance-agent connection." },
  { n: "03", t: "It proposes an action", d: "Buy $100 BTC · open a futures long · withdraw — with its reasoning." },
  { n: "04", t: "Policy engine checks", d: "Every rule is evaluated deterministically. No opinions, no guesswork." },
  { n: "05", t: "Approved or blocked", d: "A clear verdict with the exact rule that stopped it." },
  { n: "06", t: "You approve → audited", d: "If required, a human confirms. Every step lands in the audit trail." },
];

const SHOWCASE = [
  { sym: "BTC", line: "Buy $100 BTC · spot" },
  { sym: "BTC", line: "Buy $250 BTC · spot" },
  { sym: "SOL", line: "Buy $80 SOL · spot" },
  { sym: "BTC", line: "Long BTC · futures" },
  { sym: "USDT", line: "Withdraw $40 USDT" },
];

const FEATURES = [
  { icon: SlidersHorizontal, t: "A real policy engine", d: "Deterministic rules — capital, assets, position size, risk, derivatives, withdrawals — not a chatbot with vibes." },
  { icon: ShieldCheck, t: "Human in the loop", d: "Require approval and the agent freezes until a person signs off on the exact action." },
  { icon: OctagonX, t: "Emergency stop", d: "One tap halts the agent. No further research, no further proposals, no executions." },
  { icon: History, t: "Tamper-evident audit trail", d: "Action → checks → verdict → approval → execution, timestamped with policy version and evidence, exportable as a hash-chained receipt." },
  { icon: Lock, t: "Secrets never in the web app", d: "No API keys, no withdrawals in Demo Mode, and a built-in no-withdrawal stance to mirror Agent OS." },
  { icon: Sparkles, t: "Built for the demo", d: "A full judge run in 60 seconds with zero signup, zero deposit, zero real orders." },
];

/**
 * A neutral showcase row on the landing hero. Like the app's scenario chips,
 * it deliberately does NOT preview a verdict — the action name is all that is
 * shown, so nothing on this page can read as a scripted answer before the
 * demo actually runs the proposal through the engine.
 */
function ShowcaseRow({ sym, line }: { sym: string; line: string }) {
  return (
    <div className="row items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-display text-[11px] font-bold text-slate-200 ring-1 ring-white/10">
        {sym.slice(0, 4)}
      </span>
      <span className="mono min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-200">{line}</span>
    </div>
  );
}

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-glow" aria-hidden />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="row gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 shadow-glow">
            <Shield className="h-[18px] w-[18px] text-ink-950" strokeWidth={2.6} />
          </span>
          <span className="h-display text-lg text-white">
            Agent<span className="text-gradient">Guard</span>
          </span>
        </Link>
        <div className="row gap-2">
          <a href="#how" className="hidden text-sm font-medium text-slate-300 hover:text-white sm:block">
            How it works
          </a>
          <Link href="/app" className="btn btn-primary !py-2">
            Open app <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="row gap-2">
              <span className="chip chip-violet"><Bot className="h-3 w-3" /> Binance Agent OS Mini Hackathon · Track A</span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Your AI can trade.
              <br />
              <span className="text-gradient">Your rules decide whether it can.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              AgentGuard is a policy and safety layer for AI agents that interact with Binance. Your
              agent researches and proposes — AgentGuard evaluates every action against your
              mandate before anything touches an exchange, then logs it all to an audit trail.
            </p>
            <div className="row mt-7 flex-wrap gap-3">
              <Link href="/app" className="btn btn-primary px-6 !py-3 text-base">
                <Play className="h-4 w-4 fill-current" /> Run the 60-second demo
              </Link>
              <a href="#how" className="btn btn-ghost px-6 !py-3 text-base">
                See how it works
              </a>
            </div>
            <div className="row mt-4 gap-1.5 text-[11px] muted">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> No signup · No deposit · No real orders in Demo Mode
            </div>
          </div>

          {/* Live proposal showcase — actions only, no verdict preview */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            <div className="row justify-between px-1 pb-3">
              <span className="row gap-1.5 text-xs font-semibold text-slate-200">
                <ShieldCheck className="h-4 w-4 text-cyan-300" /> Nova · mandate: BTC+ETH, $150 max, spot only
              </span>
              <span className="chip chip-info">demo preview · no real orders</span>
            </div>
            <div className="grid gap-2">
              {SHOWCASE.map((s) => (
                <ShowcaseRow key={s.line} sym={s.sym} line={s.line} />
              ))}
            </div>
            <p className="mt-3 px-1 text-[11px] leading-relaxed text-slate-500">
              Verdicts aren&apos;t printed on these cards — run the demo and the engine answers each
              proposal live from this exact mandate. No scripted answers.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-5 pt-24">
        <div className="text-center">
          <span className="chip chip-info">The workflow</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
            Every action, <span className="text-gradient">guarded</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
            Goal → research → proposed action → policy check → approved or blocked → human approval
            if required → exchange action → audit record.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card card-pad relative overflow-hidden">
              <span className="absolute -right-2 -top-4 font-display text-6xl font-bold text-white/[0.05]">{s.n}</span>
              <div className="row gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300">
                <CircleCheck className="h-4 w-4" /> {s.t}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-24">
        <div className="text-center">
          <span className="chip chip-ok">Why AgentGuard</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
            Not a crypto chatbot.<br />A <span className="text-gradient">guardrail</span>.
          </h2>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="card card-pad">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-300 ring-1 ring-white/10">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-white">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agent OS alignment band */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-24">
        <div className="card overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-2">
            <div>
              <span className="chip chip-violet">Built for Binance Agent OS</span>
              <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
                AgentGuard sits in front of your agent. Binance Agent OS does the rest.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Agent OS connects agents to Binance through its MCP server — market data, an Agentic
                sub-account, scoped trading and transfers, with every trade confirmed by you and no
                withdrawal scope. AgentGuard adds your personal mandate on top: the deterministic
                policy check that decides what the agent is even <em>allowed</em> to propose.
              </p>
              <div className="row mt-5 flex-wrap gap-2 text-[11px] muted">
                <span className="chip chip-ok">market data scope</span>
                <span className="chip chip-ok">Agentic sub-account</span>
                <span className="chip chip-critical">no withdrawal scope</span>
                <span className="chip chip-plain">confirm-before-execute</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-2xl border border-white/[0.07] bg-ink-950/50 p-5">
              {[
                { icon: ShieldAlert, text: "Policy engine evaluates agent intent before Agent OS executes it." },
                { icon: ShieldCheck, text: "Approved actions still require your confirmation inside Agent OS." },
                { icon: Lock, text: "No keys in this web app. Live wiring happens on your desktop, your account." },
              ].map((r) => (
                <div key={r.text} className="row items-start gap-3 text-sm text-slate-300">
                  <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-violet-500/15 to-fuchsia-500/15" aria-hidden />
          <div className="relative">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 shadow-glow">
              <FlaskConical className="h-7 w-7 text-ink-950" />
            </span>
            <h2 className="mx-auto mt-5 max-w-xl font-display text-3xl font-bold text-white">
              Watch it approve one trade and block four others — in 60 seconds.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-300">
              The demo needs no account, no API key and no money. Then rebuild the policy and watch
              the same agent behave differently.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/app" className="btn btn-primary px-7 !py-3 text-base">
                Start the demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/app/policy" className="btn btn-ghost px-6 !py-3 text-base">
                <SlidersHorizontal className="h-4 w-4" /> Edit the policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex flex-col gap-3 text-xs muted sm:flex-row sm:items-center sm:justify-between">
            <div className="row gap-2">
              <Shield className="h-4 w-4 text-slate-600" />
              <span>
                AgentGuard is a policy &amp; safety layer and is <span className="font-semibold text-slate-400">not financial advice</span>.
                Digital assets are volatile. Demo Mode never executes a real order.
              </span>
            </div>
            <span className="row gap-1"><Ban className="h-3 w-3" /> Built for the Binance Agent OS Mini Hackathon</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
