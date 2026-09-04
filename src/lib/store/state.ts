import type {
  AgentStatus,
  AuditEvent,
  GuardContext,
  IntentOrigin,
  Policy,
  PolicyVersionRecord,
  ProposedAction,
  Tone,
} from "@/lib/engine/types";
import { DEFAULT_POLICY } from "@/lib/engine/defaults";
import { nextPolicyRecord } from "@/lib/engine/versioning";
import type { MarketResult } from "@/lib/market";

export type Mode = "demo" | "live";

/** The last single intent run through the guard (custom / scenario / attack). */
export interface LastProposal {
  action: ProposedAction;
  intent: IntentOrigin;
  prompt?: string;
}

/** Everything the app shell needs, kept as plain serializable data. */
export interface AppState {
  mode: Mode;
  policy: Policy;
  /** Versioned mandate history — every save becomes a diffable record. */
  policyHistory: PolicyVersionRecord[];
  /** Live agent status (idle → running → awaiting-approval → …). */
  status: AgentStatus;
  /** Append-only audit feed. Single source of truth for history + approvals. */
  events: AuditEvent[];
  /** Position in the demo script (0 = not started). */
  scriptIndex: number;
  scriptDone: boolean;
  /**
   * True while the feed belongs to a full scripted demo run. Single proposals
   * (scenario, custom, attack) set this to false so an approval can never
   * resume the full script mid-way.
   */
  scripted: boolean;
  /** Last single intent (for "re-run the same proposal under a new mandate"). */
  lastProposal: LastProposal | null;
  /** Latest market snapshot (live Binance or labelled fallback). */
  snapshot: MarketResult | null;
}

export type AppAction =
  | { type: "hydrate"; patch: Partial<AppState> }
  | { type: "set-mode"; mode: Mode }
  | { type: "set-policy"; policy: Policy }
  | { type: "set-status"; status: AgentStatus }
  | { type: "set-snapshot"; snapshot: MarketResult | null }
  | { type: "set-script"; scriptIndex?: number; done?: boolean; scripted?: boolean }
  | { type: "set-last-proposal"; last: LastProposal | null }
  | { type: "append"; events: AuditEvent[] }
  | {
      type: "resolve-approval";
      eventId: string;
      result: "approved" | "rejected";
      followup: AuditEvent[];
    }
  | { type: "begin-demo" }
  | { type: "clear-all" };

export const initialState: AppState = {
  mode: "demo",
  policy: DEFAULT_POLICY,
  policyHistory: [],
  status: "idle",
  events: [],
  scriptIndex: 0,
  scriptDone: false,
  scripted: false,
  lastProposal: null,
  snapshot: null,
};

/**
 * The broker book implied by the audit feed — the `GuardContext` the engine
 * consults for aggregate rules. Exposure is NOTIONAL AT ENTRY:
 *  · buys add entry notional to the asset's position;
 *  · sells reduce it (a sell below cost realizes the loss for the halt rule);
 *  · P&L never changes exposure until realized.
 * "Today" = everything in the feed (the demo session is short-lived); a real
 * caller supplies its own daily aggregates to the Guard API.
 */
export function computeBook(events: AuditEvent[]): GuardContext {
  const positions: Record<string, number> = {};
  let exposureUsd = 0;
  let realizedLossTodayUsd = 0;
  let ordersToday = 0;
  let dailyNotionalUsd = 0;

  for (const e of events) {
    if (!e.action) continue;
    const a = e.action;
    const sym = a.symbol.toUpperCase();
    if (e.event === "executed" && a.kind === "trade") {
      ordersToday += 1;
      const held = positions[sym] ?? 0;
      if (a.side === "buy") {
        positions[sym] = held + a.notionalUsd;
        exposureUsd += a.notionalUsd;
        dailyNotionalUsd += a.notionalUsd;
      } else {
        const leaving = Math.min(held, a.notionalUsd);
        positions[sym] = held - leaving;
        exposureUsd = Math.max(0, exposureUsd - leaving);
        // A sell is only a *realized loss* if we also know the entry cost of
        // the shares sold; the demo has no such granular P&L, so sells below
        // their executed notional are treated as risk-reducing, never as a
        // fresh loss. Real callers supply realizedLossTodayUsd explicitly.
        void leaving;
      }
    }
    // Realized losses can also be reported explicitly by an external caller.
    // Not computed here because prices in the demo are static.
    void realizedLossTodayUsd;
  }

  return {
    exposureUsd,
    positions,
    realizedLossTodayUsd: realizedLossTodayUsd > 0 ? realizedLossTodayUsd : undefined,
    ordersToday,
    dailyNotionalUsd,
  };
}

/** Audit rows that still await a human decision. */
export function pendingApprovals(events: AuditEvent[]): AuditEvent[] {
  return events.filter(
    (e) =>
      e.event === "policy-decision" &&
      e.verdict === "approved" &&
      e.requiresApproval &&
      e.approvalState === "awaiting"
  );
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.patch, status: "idle" };

    case "begin-demo":
      return {
        ...state,
        events: [],
        scriptIndex: 0,
        scriptDone: false,
        scripted: true,
        lastProposal: null,
        status: "running",
      };

    case "clear-all":
      return {
        ...initialState,
        mode: state.mode,
        policy: state.policy,
        policyHistory: state.policyHistory,
        snapshot: state.snapshot,
      };

    case "set-policy": {
      const prev = state.policy;
      const record = nextPolicyRecord(prev, action.policy);
      // No meaningful change (only updatedAt bumped)? Keep the version stable.
      if (record.diff.length === 0) {
        return {
          ...state,
          policy: { ...prev, name: action.policy.name, updatedAt: action.policy.updatedAt },
        };
      }
      const policy = { ...action.policy, version: record.version };
      return {
        ...state,
        policy,
        policyHistory: [
          ...state.policyHistory,
          { ...record, version: record.version, policy },
        ],
      };
    }

    case "set-mode":
      return { ...state, mode: action.mode };

    case "set-status":
      return { ...state, status: action.status };

    case "set-snapshot":
      return { ...state, snapshot: action.snapshot };

    case "set-script":
      return {
        ...state,
        scriptIndex: action.scriptIndex ?? state.scriptIndex,
        scriptDone: action.done ?? state.scriptDone,
        scripted: action.scripted ?? state.scripted,
      };

    case "set-last-proposal":
      return { ...state, lastProposal: action.last };

    case "append": {
      if (action.events.length === 0) return state;
      const base = state.events.length;
      const stamped = action.events.map((e, i) => ({ ...e, seq: base + i }));
      return { ...state, events: [...state.events, ...stamped] };
    }

    case "resolve-approval": {
      const tone: Tone = action.result === "approved" ? "ok" : "warn";
      const marked = state.events.map((e) =>
        e.id === action.eventId ? { ...e, approvalState: action.result, tone } : e
      );
      const base = marked.length;
      const followup = action.followup.map((e, i) => ({ ...e, seq: base + i }));
      return { ...state, events: [...marked, ...followup] };
    }

    default:
      return state;
  }
}
