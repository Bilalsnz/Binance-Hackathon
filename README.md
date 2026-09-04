# AgentGuard 🛡️

**Your AI can trade. Your rules decide whether it can.**

AgentGuard is a **policy & safety layer for AI agents that interact with Binance** — built for the
**Binance Agent OS Mini Hackathon · Track A (Agent Creation)**. The agent researches and *proposes*;
AgentGuard evaluates every proposed action against the mandate *you* define — capital limit, allowed
assets, max position size, max loss, spot/futures permission, withdrawals, approval-required — then
records every decision to an audit trail.

> AgentGuard is a policy layer, **not** a crypto chatbot, market analyst, price predictor, or an
> ordinary trading bot. The *controlled agent workflow* is the product.

![Next.js](https://img.shields.io/badge/Next.js-14.2-000?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06b6d4?logo=tailwindcss) ![cost](https://img.shields.io/badge/cost-%240-blue) ![tests](https://img.shields.io/badge/tests-14%20passing-emerald)

---

## Why this exists

AI agents are being handed real exchange access. Today's guardrails are mostly *prompts* — "be
careful", "don't lose money". Prompts are not policy. AgentGuard makes safety **deterministic**: a
tiny, testable engine checks every action an agent proposes against rules you control, and produces a
structured, auditable verdict the agent cannot argue with.

```
USER GOAL → AGENT RESEARCH → PROPOSED ACTION → POLICY CHECK → APPROVED / BLOCKED
              → USER APPROVAL (if required) → EXCHANGE ACTION → AUDIT RECORD
```

### The judge flow (60 seconds, zero setup)

1. Open **AgentGuard → Home → “Run the 60-second demo”**.
2. Agent `Nova` researches BTC, then proposes **Buy $100 BTC (spot)** → policy passes → **APPROVED — needs your OK**. The run pauses here.
3. You tap **Approve** on the decision card → demo broker executes (simulated fill) → audit logged → the run resumes.
4. Nova proposes **Buy $250 BTC** → **BLOCKED** (exceeds the $150 position cap).
5. Nova proposes **Buy $80 SOL** → **BLOCKED** (SOL not on the allowlist).
6. Nova proposes a **BTC futures long** → **BLOCKED** (derivatives disabled).
7. Nova tries to **withdraw $40** → **BLOCKED** (withdrawals disabled).
8. Nova proposes **Buy $60 ETH** → **APPROVED — needs your OK**, a second human pause; approve it and the run finishes.
9. Open **Audit** → every decision is there: proposal, policy result, exact reason, approval state and execution state. Filter to **Blocked** to see all four blocked verdicts at a glance.

Change the policy and replay — the *same* agent behaves differently, because the engine is real logic.
(The demo pauses twice on purpose: approving an action is the point of the product.)

---

## Screens

| Screen | Route | What you see |
|---|---|---|
| Landing | `/` | Value proposition, live verdict showcase, workflow, Agent OS alignment |
| Home (dashboard) | `/app` | Agent status + run controls, mandate summary, exchange connection, recent decisions |
| Agent activity | `/app/agent` | Live research → proposal → decision feed with policy checks |
| Approvals | `/app/approvals` | Every action that needs your sign-off, with Approve / Decline |
| Policy builder | `/app/policy` | Mandate editor: assets, limits, permissions, presets, live posture meter |
| Audit history | `/app/audit` | Filterable trail of decisions with timestamps, results and reasons |

*Screenshots: add captures here before submission — see [`screenshots/`](screenshots/) placeholders.*

---

## Local setup (Android / Acode friendly)

```bash
# in Acode's terminal (or any Node 18+/22+ shell)
cd agentguard          # this folder
npm install            # install deps (~once)
npm run dev            # start dev server → http://localhost:3000
```

Build, test and lint exactly as on CI:

```bash
npm test               # 14 policy-engine tests (node:test + tsx, no extra framework)
npm run typecheck      # tsc --noEmit
npm run lint           # next lint (ESLint)
npm run build          # production build → out of .next
```

No environment variables are required. The app runs fully in **Demo Mode** out of the box.

---

## Demo Mode vs Live Mode

AgentGuard has two explicitly distinct modes — it never blurs them.

| | Demo Mode (default) | Live view |
|---|---|---|
| Broker | **Simulated demo broker** — clearly-labelled mock fills | Your own Binance **Agent OS** agent |
| Orders | Never real — zero deposit, zero execution | Requires your account + desktop Agent OS wiring |
| Market research | Live Binance **public** market data when reachable, otherwise labelled demo quotes | Live Binance public data + Agent OS |
| Credentials | None | None stored in this app, ever |
| Purpose | Judges run the full product safely | Reference wiring (see below) |

### Binance Agent OS — what AgentGuard actually uses, and why

AgentGuard is built to sit **in front of** a Binance-agent connection. Binance **Agent OS**
([binance.com/en/agent-os](https://www.binance.com/en/agent-os)) is the developer platform that
connects agents to Binance via the **Binance MCP Server**, exchange APIs, and the open
[Binance Skills Hub](https://github.com/binance/binance-skills-hub). AgentGuard adds the *CONTROL*
layer: your personal mandate enforced deterministically before the agent's intent reaches an
exchange.

Record of Binance Agent OS capabilities AgentGuard is aligned to and why (verified against official
docs, Sep 2026 — see the research log in `ARCHITECTURE.md`):

| Agent OS capability (official) | Why AgentGuard cares | How it's represented here |
|---|---|---|
| **Market data scope** (public, no auth) | The agent's research must never require secrets | AgentGuard research feed calls the same keyless public surface (`/api/v3/ticker/24hr`) with a labelled live/fallback path |
| **Dedicated Agentic sub-account** | Isolation is the safest default for an autonomous agent | Demo broker isolates fills; UI communicates sub-account isolation |
| **Trade scope** (spot/margin/convert/USDⓈ-M/COIN-M) | AgentGuard's `market` + `risk` rules gate *which* of these may be proposed | `spot`/`futures` markets in the policy engine; futures disabled by default |
| **Transfer scope** (inside sub-account only) | Transfers are a real agent power worth gating | `transfer`/`withdraw` kinds exist in the model; withdrawals default-off |
| **No withdrawal scope exists** | Binance structurally prevents agent withdrawals to external addresses | AgentGuard mirrors it as the `withdrawals` rule (fail-closed) |
| **Every trade/transfer confirmed by you first** | Approval-required is AgentGuard's core value | `requireApproval` rule + Approvals screen + re-check on approve |
| **OAuth consent to your Agentic sub-account, desktop-only** | The MCP endpoint is personal and must never leak | Live wiring happens on your machine/account — never in this repo or chat |

**Honest limitation (why there is no one-click “Live” here):** connecting the hosted Binance MCP
Server requires *your* Binance account, OAuth consent, and a desktop MCP client; Binance explicitly
warns never to paste the per-user MCP endpoint into chat or the browser. A public web app therefore
cannot and should not hold that connection. So the deployed product demonstrates the *full* product
in Demo Mode and documents the live wiring runbook for the judge/user to run on their own machine.

### Live wiring runbook (your desktop, your account)

1. Follow the official Agent OS steps to connect your MCP client (Claude Code etc.) to the
   **Binance MCP Server** and authorize a scoped **Agentic sub-account** (no withdrawal scope).
   Fund the sub-account yourself, only with what the agent may trade.
2. Run AgentGuard locally (`npm run dev`), set your mandate in the Policy builder, and press
   **Run**.
3. Let your MCP-connected agent research/propose; run each proposal through AgentGuard's
   `evaluateAction` (it is a pure function — call it from any script) and feed approved intents to
   your agent for execution. Agent OS itself will still ask you to confirm before it sends the order.
4. Stay in Demo Mode for judging — it requires nothing and executes nothing.

AgentGuard itself **never places a real order from the web app**, never holds or asks for your Binance
API keys, and never bypasses Binance auth, permissions, or regional restrictions.

---

## Policy engine

Located in `src/lib/engine/`. Pure TypeScript, no I/O, fully unit-tested (14 tests).

| Rule | What it enforces | Blocked example |
|---|---|---|
| `capital` | Running exposure (executed buys) never exceeds the mandate ceiling | Buying when exposure would exceed `maxCapitalUsd` |
| `allowed-assets` | Only allowlisted base assets may be traded | `SOL` when allowlist is `BTC, ETH` |
| `position-size` | Single-order notional ≤ per-position cap | `$250 BTC` when cap is `$150` |
| `risk-per-trade` | Agent's own worst-case loss estimate ≤ the loss cap | `estRiskUsd $90` when cap is `$20` |
| `market` | Spot always; futures only if `allowFutures` | Any `futures` action when disabled |
| `withdrawals` | Outbound transfers only if `allowWithdrawals` | Any withdrawal when disabled |

Key contract — all four shapes are plain JSON and survive the whole pipeline:

```ts
Policy × ProposedAction → PolicyCheck[] → Decision { state, checks, blockedBy, requiresApproval } → AuditEvent[]
```

**`evaluateAction(policy, action, currentExposureUsd)` is a pure function.** The same code runs on the
client, on the server and in the unit tests — the demo verdicts are the real engine, not a scripted
look-alike. Change the policy and the demo's decisions change with it.

Run the checks:

```bash
npm test
```

---

## Environment variables

Everything is optional. The app works with none set.

| Variable | Used for | Secret |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL in metadata | no |
| `AGENTGUARD_MARKET_BASE_URL` | Override Binance public API base (e.g. regional mirror) | no |

No secret keys exist in this project. See `.env.example`.

---

## Security posture

- **No secrets in frontend code.** No API keys anywhere; nothing is committed under `.env*`.
- **Demo Mode executes nothing.** Executions are explicitly simulated and labelled.
- **Human-in-the-loop.** `requireApproval` freezes the agent until a person approves the exact action
  — and AgentGuard re-checks the action against the *current* policy at approval time.
- **Emergency stop.** One tap halts research, proposals and executions (see Home header).
- **Binance-safe by construction.** AgentGuard mirrors Agent OS's no-withdrawal stance and never
  bypasses Binance authentication or permissions.
- **Not financial advice.** Stated in the app and the footer. Crypto is volatile; agents make
  mistakes; you are responsible for your own trading decisions.

---

## Project structure

```
src/
  app/                 # routes: / (landing) · /app/* (the product) · /api/market/snapshot
  components/          # decision cards, feed, dashboard, policy builder, app shell
  lib/
    engine/            # ★ policy engine: types.ts · policy.ts · engine.test.ts · defaults.ts
    demo/              # scripted demo timeline + labelled quote fallbacks
    store/             # React state machine, audit store, localStorage persistence
    market.ts          # live Binance public market snapshot (keyless) w/ fallback
```

`ARCHITECTURE.md` has the full flow diagram, file map and data-model walkthrough.

---

## Deployment (free tier)

Vercel free tier, same as any Next.js app:

```bash
# 1. Push this repo to GitHub
# 2. Import at vercel.com/new  (Next.js is auto-detected; no build config needed)
# 3. Deploy. Done — no env vars required.
```

The live-market research feed upgrades automatically where Binance's public API is reachable and
falls back to labelled demo quotes where it isn't.

---

## License

MIT — see [LICENSE](LICENSE). Built for the Binance Agent OS Mini Hackathon. Not affiliated with or
endorsed by Binance. See the full disclaimer in the footer of the app.
