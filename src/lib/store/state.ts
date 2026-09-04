import type {
  AgentStatus,
  AuditEvent,
  Policy,
  Tone,
} from "@/lib/engine/types";
import { DEFAULT_POLICY } from "@/lib/engine/defaults";
import type { MarketResult } from "@/lib/market";

export type Mode = "demo" | "live";

/** Everything the app shell needs, kept as plain serializable data. */
export interface AppState {
  mode: Mode;
  policy: Policy;
  /** Live agent status (idle → running → awaiting-approval → …). */
  status: AgentStatus;
  /** Append-only audit feed. Single source of truth for history + approvals. */
  events: AuditEvent[];
  /** Position in the demo script (0 = not started). */
  scriptIndex: number;
  scriptDone: boolean;
  /**
   * True while the feed belongs to a full scripted demo run. Single scenarios
   * played from the dashboard set this to false so an approval can never
   * resume the full script mid-way (the two flows stay distinct).
   */
  scripted: boolean;
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
  status: "idle",
  events: [],
  scriptIndex: 0,
  scriptDone: false,
  scripted: false,
  snapshot: null,
};

/** Running USD exposure implied by the audit feed (executed demo buys). */
export function computeExposure(events: AuditEvent[]): number {
  return events.reduce((acc, e) => {
    if (e.event !== "executed" || !e.action || e.action.kind !== "trade") {
      return acc;
    }
    const delta = e.action.side === "buy" ? e.action.notionalUsd : -e.action.notionalUsd;
    return Math.max(0, acc + delta);
  }, 0);
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
      return { ...state, events: [], scriptIndex: 0, scriptDone: false, scripted: true, status: "running" };

    case "clear-all":
      return {
        ...initialState,
        mode: state.mode,
        policy: state.policy,
        snapshot: state.snapshot,
      };

    case "set-policy":
      return { ...state, policy: action.policy };

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
