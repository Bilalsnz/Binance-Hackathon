/**
 * AgentGuard domain model.
 *
 * Everything flows through one pipeline:
 *   Policy (user rules)  ×  ProposedAction (agent intent)
 *     →  PolicyCheck[]   →  Decision  →  AuditEvent
 *
 * These types are plain JSON so they survive localStorage, the share/audit
 * stream and unit tests without any framework coupling.
 */

/** A buy or sell direction. */
export type Side = "buy" | "sell";

/** Spot trading on Binance, or derivatives (USDⓈ-M futures). */
export type Market = "spot" | "futures";

/** The families of action an agent can propose. */
export type ActionKind = "trade" | "transfer" | "withdraw";

/** The policy the user controls. Pure data — no functions. */
export interface Policy {
  name: string;
  /** Running exposure ceiling across all open positions, in USD. */
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
  /** ISO timestamp of last update. */
  updatedAt: string;
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

export type RuleId =
  | "capital"
  | "allowed-assets"
  | "position-size"
  | "risk-per-trade"
  | "market"
  | "withdrawals";

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
  /** Exposure that would result if this action executed, USD. */
  exposureAfterUsd: number;
  evaluatedAt: string;
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
}
