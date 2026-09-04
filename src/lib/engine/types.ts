/**
 * Mandate domain model.
 *
 * Everything flows through one pipeline:
 *   Policy (user rules)  ×  ProposedAction (agent intent) + GuardContext (book)
 *     →  PolicyCheck[]   →  Decision  →  AuditEvent (+ NormalizedCall evidence)
 *
 * These types are plain JSON so they survive localStorage, the Guard HTTP API,
 * receipts and unit tests without any framework coupling.
 */

/** A buy or sell direction. */
export type Side = "buy" | "sell";

/** Spot trading on Binance, or derivatives (USDⓈ-M futures). */
export type Market = "spot" | "futures";

/** The families of action an agent can propose. */
export type ActionKind = "trade" | "transfer" | "withdraw";

/**
 * Where an intent came from. Used only for labeling/evidence — the engine never
 * makes a decision based on it.
 */
export type IntentOrigin = "user" | "scenario" | "adversarial" | "scripted";

/** The policy the user controls. Pure data — no functions. */
export interface Policy {
  name: string;
  /** Monotonic version. Bumped by the store on every saved change. */
  version: number;
  /** Running exposure ceiling across all open positions (notional), in USD. */
  maxCapitalUsd: number;
  /** Assets the agent is allowed to trade, e.g. ["BTC","ETH"]. */
  allowedAssets: string[];
  /** Hard cap on a single order's USD notional. */
  maxPositionUsd: number;
  /** Cap on the agent's own estimate of worst-case loss per trade, USD. */
  maxLossPerTradeUsd: number;
  /** Whether derivatives (futures) are permitted at all. */
  allowFutures: boolean;
  /** Whether withdrawals / outbound transfers are permitted. */
  allowWithdrawals: boolean;
  /** Whether every approved action must be confirmed by a human first. */
  requireApproval: boolean;
  /**
   * Daily loss / drawdown halt (USD). Once realized losses today reach this
   * level the guard halts further *trades*. Losses are what actually realized
   * (a position sold below cost), never the agent's estimates.
   */
  dailyLossLimitUsd: number;
  /**
   * Concentration cap: total notional held in ONE asset may not exceed this,
   * even if several small buys add up. Counts the position that would result
   * after this order. Undefined book → enforced on the order alone.
   */
  maxSingleAssetUsd: number;
  /** Rate limit: max executed orders per day (blocks micro-order splitting). */
  maxOrdersPerDay: number;
  /** Aggregate daily buy notional cap — many small orders can't bypass it. */
  maxDailyNotionalUsd: number;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/**
 * The broker book the guard consults when it evaluates an action. Optional for
 * ad-hoc tests (the engine then enforces only rules it has data for); REQUIRED
 * for a real evaluation where a caller wants every aggregate rule enforced.
 *
 * Exposure accounting: `exposureUsd` and `positions` are NOTIONAL-at-entry
 * (USD committed when the buy filled), NOT mark-to-market. P&L never changes
 * exposure until it is realized by a sell; the daily-loss rule counts only
 * realized losses. This keeps the guard deterministic and auditable.
 */
export interface GuardContext {
  /** Sum of open position notionals (entry). */
  exposureUsd: number;
  /** Notional held per asset symbol, e.g. { BTC: 100 }. */
  positions?: Record<string, number>;
  /** Realized USD loss today (sells below cost). */
  realizedLossTodayUsd?: number;
  /** Executed orders today. */
  ordersToday?: number;
  /** Aggregate notional of buys executed today. */
  dailyNotionalUsd?: number;
}

/** An action an agent proposes to take on the exchange. */
export interface ProposedAction {
  id: string;
  createdAt: string;
  /** Name of the agent that proposed it. */
  actor: string;
  /** Human goal the agent is pursuing, e.g. "Buy the BTC dip". */
  goal: string;
  kind: ActionKind;
  market: Market;
  /** Base asset symbol without the quote, e.g. "BTC". */
  symbol: string;
  side: Side;
  /** USD notional value of the order. */
  notionalUsd: number;
  /** Agent's own worst-case loss estimate for this trade, USD. */
  estRiskUsd: number;
  /** The agent's plain-language rationale. */
  reason: string;
}

/**
 * The normalized, tool-call-shaped form of an intent. This is what Mandate
 * records as evidence and what a desktop Guard-API / MCP integration would hand
 * to the guard BEFORE the underlying Binance tool executes. It is Mandate's
 * normalized shape (derived 1:1 from the action) — not a claim about Binance's
 * wire format.
 */
export interface NormalizedCall {
  kind: ActionKind;
  market: Market;
  symbol: string;
  side: Side;
  notionalUsd: number;
  estRiskUsd: number;
  /** Original instruction/goal the agent was acting on. */
  intent: string;
  /** Flat params a tool layer would receive, derived from the action. */
  params: {
    notionalUsd: number;
    symbol: string;
    market: Market;
    side: Side;
  };
}

export type RuleId =
  | "capital"
  | "allowed-assets"
  | "position-size"
  | "risk-per-trade"
  | "market"
  | "withdrawals"
  | "daily-loss"
  | "concentration"
  | "order-rate"
  | "daily-notional";

/** The outcome of a single policy rule for one action. */
export interface PolicyCheck {
  rule: RuleId;
  passed: boolean;
  /** Human-readable detail that explains exactly why it passed or failed. */
  detail: string;
}

export type DecisionState = "approved" | "blocked";

/** Result of running the full policy over one proposed action. */
export interface Decision {
  state: DecisionState;
  checks: PolicyCheck[];
  /** True when the action is approved but still needs a human go-ahead. */
  requiresApproval: boolean;
  /** The checks that failed (empty when the action is approved). */
  blockedBy: PolicyCheck[];
  /** Exposure that would result if this action executed, USD (notional). */
  exposureAfterUsd: number;
  evaluatedAt: string;
}

/** One entry in the versioned policy history (before → after of every save). */
export interface PolicyVersionRecord {
  version: number;
  changedAt: string;
  policy: Policy;
  /** Field-level before/after diff against the previous version. */
  diff: Array<{ field: string; before: unknown; after: unknown }>;
}

/** Coarse tone used to color an audit row / decision card. */
export type Tone = "info" | "ok" | "warn" | "critical" | "pending" | "violet";

/** Where the data for this event actually came from. */
export type Source =
  | "simulated" // deterministic demo agent + mock quotes
  | "binance-public" // live keyless public market data
  | "binance-agent-os"; // would run through the user's Agent OS MCP agent

export type AgentStatus =
  | "idle"
  | "running"
  | "researching"
  | "proposing"
  | "awaiting-approval"
  | "stopped";

export type EventType =
  | "agent-started"
  | "research"
  | "proposal"
  | "policy-decision"
  | "approval-required"
  | "approved"
  | "rejected"
  | "executed"
  | "emergency-stop"
  | "policy-updated"
  | "system";

/** A single row in the audit feed / history. */
export interface AuditEvent {
  id: string;
  seq: number;
  ts: string;
  event: EventType;
  actor: string;
  summary: string;
  /** Optional extra context (research note, quote line, etc.). */
  detail?: string;
  tone: Tone;
  mode: "demo" | "live";
  source: Source;
  /** Structured payload for proposal / decision rows. */
  action?: ProposedAction;
  checks?: PolicyCheck[];
  verdict?: DecisionState;
  requiresApproval?: boolean;
  approvalState?: "awaiting" | "approved" | "rejected";
  /** A short, UI-safe reason string when blocked. */
  reason?: string;
  /* ---- Evidence fields (v2) ---- */

  /** Version of the mandate this row was evaluated under. */
  policyVersion?: number;
  /** Normalized tool-call payload of the proposed action (evidence). */
  payload?: NormalizedCall;
  /**
   * False when the guard refused BEFORE anything reached the broker.
   * True only on a real/simulated execution. Undefined until resolution.
   */
  sentToBroker?: boolean;
  /** Label for where the intent came from (never influences the verdict). */
  intent?: IntentOrigin;
  /** The raw instruction given to the agent (esp. for adversarial probes). */
  prompt?: string;
}
