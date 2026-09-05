"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  initialState,
  reducer,
  computeBook,
  pendingApprovals,
  type AppState,
  type LastProposal,
  type Mode,
} from "./state";
import type {
  AuditEvent,
  Decision,
  GuardContext,
  IntentOrigin,
  NormalizedCall,
  Policy,
  ProposedAction,
  RuleId,
} from "@/lib/engine/types";
import { evaluateAction } from "@/lib/engine/policy";
import { normalizeToolCall } from "@/lib/engine/normalize";
import { nextPolicyRecord } from "@/lib/engine/versioning";
import { AGENT_NAME, DEMO_SCRIPT, type DemoScriptStep } from "@/lib/demo/script";
import { quoteToUsd } from "@/lib/demo/quotes";
import { diffText, isoNow, mkEvent, summarizeDecision, uid } from "./events";
import { loadPersisted, persistState } from "./storage";

/**
 * What happened after the guard ruled ONE proposed action. Carries the produced
 * audit event's id + evidence so the caller can render the exact payload and
 * rule ids without re-reading the feed.
 */
export type ProposalOutcome =
  | {
      verdict: "blocked";
      reason?: string;
      rule?: RuleId;
      eventId: string;
      policyVersion: number;
      /** The refused action never reached a broker. */
      sentToBroker: false;
      blockedRules: RuleId[];
      /** The normalized tool-call payload recorded as evidence. */
      payload: NormalizedCall;
    }
  | {
      verdict: "needs-ok";
      reason?: string;
      eventId: string;
      policyVersion: number;
      sentToBroker: false;
      blockedRules: [];
      payload: NormalizedCall;
    }
  | {
      verdict: "approved";
      reason?: string;
      eventId: string;
      policyVersion: number;
      /** True when the demo broker received a simulated fill. */
      sentToBroker: boolean;
      blockedRules: [];
      payload: NormalizedCall;
    };

/** Back-compat alias — older code called these "scenarios". */
export type ScenarioOutcome = ProposalOutcome;

/** Evidence stamped onto every decision row (see ARCHITECTURE.md §audit). */
export interface GuardEvidence {
  policyVersion: number;
  payload: NormalizedCall;
  intent: IntentOrigin;
  prompt?: string;
}

interface AgentGuardApi {
  state: AppState;
  hydrated: boolean;
  /** Running exposure (notional at entry), USD — shorthand for `book`. */
  exposureUsd: number;
  /** The full broker book the engine consults for aggregate rules. */
  book: GuardContext;
  pending: AuditEvent[];
  lastDecision: AuditEvent | null;
  runDemo: () => void;
  resetDemo: () => void;
  stopAgent: () => void;
  resume: () => void;
  approve: (eventId: string) => void;
  reject: (eventId: string) => void;
  setPolicy: (policy: Policy) => void;
  setMode: (mode: Mode) => void;
  /**
   * Run ONE proposed action through the real policy engine (Demo Mode only)
   * and append a fully-evidenced decision to the audit trail. `intent` labels
   * where the action came from; `prompt` carries the raw instruction (used for
   * hostile-attack probes). Also records `lastProposal` so the SAME action can
   * be re-run after a mandate edit — proving the next verdict changed.
   */
  propose: (
    action: ProposedAction,
    opts?: { intent?: IntentOrigin; prompt?: string }
  ) => Promise<ProposalOutcome | null>;
  /** Re-run the last single proposal against the CURRENT policy. */
  rerunLastProposal: () => Promise<ProposalOutcome | null>;
}

const Ctx = createContext<AgentGuardApi | null>(null);

export function useAgentGuard(): AgentGuardApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgentGuard must be used inside <AgentGuardProvider>");
  return ctx;
}

export function AgentGuardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const timersRef = useRef<Set<number>>(new Set());
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.clear();
  }, []);
  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
  }, []);

  // Hydrate from localStorage once, then keep persisting on every change.
  // `hydrated` flips FIRST and unconditionally: content is never gated on it,
  // and no storage error can ever strand the app on a boot screen.
  useEffect(() => {
    setHydrated(true);
    try {
      const persisted = loadPersisted();
      if (persisted) dispatch({ type: "hydrate", patch: persisted });
    } catch {
      /* never block boot on a storage read */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState(stateRef.current);
  }, [state, hydrated]);

  // Live market snapshot for the research feed (falls back to demo quotes).
  useEffect(() => {
    let alive = true;
    fetch("/api/market/snapshot")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) dispatch({ type: "set-snapshot", snapshot: data });
      })
      .catch(() => {
        /* keep null — research cards show a graceful state */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /** Assemble an audit event with the current mode/source defaults. */
  const stampEvent = useCallback(
    (seed: Parameters<typeof mkEvent>[0] & { actor?: string }): AuditEvent =>
      mkEvent({
        mode: stateRef.current.mode,
        source: "simulated",
        ...seed,
      }),
    []
  );

  /**
   * Evidence attached to every row about one action: the mandate version it was
   * evaluated under, the normalized tool-call payload, and its provenance. The
   * version is read at STAMP time (stateRef), so rows never lie about which
   * policy produced them — even when the mandate changes a tick later.
   */
  const guardEvidence = useCallback(
    (action: ProposedAction, intent: IntentOrigin, prompt?: string): GuardEvidence => ({
      policyVersion: stateRef.current.policy.version,
      payload: normalizeToolCall(action),
      intent,
      prompt,
    }),
    []
  );

  const actionFromStep = useCallback(
    (step: Extract<DemoScriptStep, { type: "action" }>): ProposedAction => ({
      id: uid(),
      createdAt: isoNow(),
      actor: AGENT_NAME,
      goal: step.goal,
      kind: step.kind,
      market: step.market,
      symbol: step.symbol,
      side: step.side,
      notionalUsd: step.notionalUsd,
      estRiskUsd: step.estRiskUsd,
      reason: step.reason,
    }),
    []
  );

  /**
   * Follow-on events that mark an action as having reached the (simulated)
   * broker. `sentToBroker: true` here means the demo exchange accepted it —
   * never a real Binance fill.
   */
  const executedFollowups = useCallback(
    (action: ProposedAction, ev: GuardEvidence): AuditEvent[] => [
      stampEvent({
        event: "executed",
        actor: "Demo broker",
        summary: `Demo fill — ${action.side} ${action.symbol} at market. Simulated.`,
        tone: "ok",
        action,
        ...ev,
        sentToBroker: true,
      }),
    ],
    [stampEvent]
  );

  const finishRun = useCallback(() => {
    const s = stateRef.current;
    dispatch({ type: "set-status", status: "idle" });
    dispatch({ type: "set-script", done: true });
    const executed = s.events.filter((e) => e.event === "executed").length;
    const blocked = s.events.filter(
      (e) => e.event === "policy-decision" && e.verdict === "blocked"
    ).length;
    const declined = s.events.filter((e) => e.event === "rejected").length;
    dispatch({
      type: "append",
      events: [
        stampEvent({
          event: "system",
          summary: `Run complete — ${executed} executed · ${blocked} policy-blocked${
            declined ? ` · ${declined} declined` : ""
          }.`,
          tone: "info",
        }),
      ],
    });
  }, [stampEvent]);

  const advance = useCallback(() => {
    const s = stateRef.current;
    // Never step past an open human gate — the pending queue is the source of
    // truth, not the status field — and never run while the stop is engaged.
    if (s.status === "stopped") return;
    if (pendingApprovals(s.events).length > 0) return;
    const step = DEMO_SCRIPT[s.scriptIndex];
    if (!step) {
      finishRun();
      return;
    }
    dispatch({ type: "set-script", scriptIndex: s.scriptIndex + 1 });

    if (step.type === "research") {
      dispatch({ type: "set-status", status: "researching" });
      const quote = stateRef.current.snapshot?.quotes[step.symbol];
      const quoteLine = quote
        ? `$${quoteToUsd(quote)} · ${quote.changePct24h >= 0 ? "+" : ""}${quote.changePct24h.toFixed(
            2
          )}% (24h)`
        : "quote unavailable";
      const live = quote?.source === "live";
      dispatch({
        type: "append",
        events: [
          stampEvent({
            event: "research",
            actor: AGENT_NAME,
            source: live ? "binance-public" : "simulated",
            summary: `${AGENT_NAME} researched ${step.symbol} — ${step.headline}`,
            detail: `${quoteLine}\n${step.note}`,
            tone: "info",
          }),
        ],
      });
      schedule(() => advance(), 1600);
      return;
    }

    // Action step — run it through the real policy engine with the full book.
    dispatch({ type: "set-status", status: "proposing" });
    const action = actionFromStep(step);
    const s2 = stateRef.current;
    const ev = guardEvidence(action, "scripted", action.goal);
    const decision: Decision = evaluateAction(
      s2.policy,
      action,
      computeBook(s2.events)
    );

    if (decision.state === "blocked") {
      dispatch({
        type: "append",
        events: [
          stampEvent({
            event: "policy-decision",
            actor: AGENT_NAME,
            summary: summarizeDecision(action, decision),
            tone: "critical",
            action,
            checks: decision.checks,
            verdict: "blocked",
            reason: decision.blockedBy[0]?.detail,
            ...ev,
            sentToBroker: false,
          }),
        ],
      });
      schedule(() => advance(), 1700);
      return;
    }

    if (decision.requiresApproval) {
      dispatch({
        type: "append",
        events: [
          stampEvent({
            event: "policy-decision",
            actor: AGENT_NAME,
            summary: summarizeDecision(action, decision),
            tone: "pending",
            action,
            checks: decision.checks,
            verdict: "approved",
            requiresApproval: true,
            approvalState: "awaiting",
            ...ev,
            sentToBroker: false,
          }),
        ],
      });
      dispatch({ type: "set-status", status: "awaiting-approval" });
      return;
    }

    // Approved without a human gate → execute straight away.
    dispatch({
      type: "append",
      events: [
        stampEvent({
          event: "policy-decision",
          actor: AGENT_NAME,
          summary: summarizeDecision(action, decision),
          tone: "ok",
          action,
          checks: decision.checks,
          verdict: "approved",
          ...ev,
          sentToBroker: true,
        }),
        ...executedFollowups(action, ev),
      ],
    });
    schedule(() => advance(), 1500);
  }, [actionFromStep, executedFollowups, finishRun, guardEvidence, schedule, stampEvent]);

  // ---- Public API ---------------------------------------------------------

  const runDemo = useCallback(() => {
    clearTimers();
    dispatch({ type: "begin-demo" });
    dispatch({
      type: "append",
      events: [
        stampEvent({
          event: "agent-started",
          actor: AGENT_NAME,
          summary: `${AGENT_NAME} came online and read your mandate. Pressing forward with research…`,
          tone: "info",
          policyVersion: stateRef.current.policy.version,
        }),
      ],
    });
    schedule(() => advance(), 700);
  }, [advance, clearTimers, schedule, stampEvent]);

  const resetDemo = useCallback(() => {
    clearTimers();
    dispatch({ type: "clear-all" });
  }, [clearTimers]);

  const stopAgent = useCallback(() => {
    clearTimers();
    dispatch({ type: "set-status", status: "stopped" });
    dispatch({
      type: "append",
      events: [
        stampEvent({
          event: "emergency-stop",
          actor: "You",
          summary: "Emergency stop engaged — the agent is paused. No further actions will run.",
          tone: "critical",
        }),
      ],
    });
  }, [clearTimers, stampEvent]);

  const resume = useCallback(() => {
    clearTimers();
    const s = stateRef.current;
    // If a decision is still waiting on the human, don't skip it — stay halted.
    if (pendingApprovals(s.events).length > 0) {
      dispatch({ type: "set-status", status: "awaiting-approval" });
      return;
    }
    dispatch({ type: "set-status", status: "running" });
    schedule(() => advance(), 500);
  }, [advance, clearTimers, schedule]);

  const approve = useCallback(
    (eventId: string) => {
      const s = stateRef.current;
      const base = s.events.find((e) => e.id === eventId && e.action);
      if (!base || !base.action) return;
      const action = base.action;
      // While the emergency stop is engaged we record intent but stay frozen —
      // nothing executes and the agent does not continue.
      const frozen = s.status === "stopped";
      // A full scripted demo marches on after the OK; a single quick-launch
      // proposal settles back instead (so an approval can never silently start
      // the whole 60-second script from step zero).
      const wasScripted = s.scripted;
      // Rows OTHER than this one still awaiting a human → the gate stays up
      // even after this approval resolves.
      const othersAwaiting = pendingApprovals(s.events).some((e) => e.id !== eventId);
      // Evidence for the human decision — evaluated under the CURRENT mandate.
      const ev = guardEvidence(action, base.intent ?? "user", base.prompt);

      // Re-check against the *current* policy in case it changed while waiting.
      const decision = evaluateAction(
        s.policy,
        action,
        computeBook(s.events)
      );

      if (decision.state === "blocked") {
        dispatch({
          type: "resolve-approval",
          eventId,
          result: "rejected",
          followup: [
            stampEvent({
              event: "policy-decision",
              actor: AGENT_NAME,
              summary: `Re-checked under updated policy — ${summarizeDecision(action, decision)}`,
              tone: "critical",
              action,
              checks: decision.checks,
              verdict: "blocked",
              reason: decision.blockedBy[0]?.detail,
              ...ev,
              sentToBroker: false,
            }),
          ],
        });
      } else {
        dispatch({
          type: "resolve-approval",
          eventId,
          result: "approved",
          followup: [
            stampEvent({
              event: "approved",
              actor: "You",
              summary: `You approved the ${action.symbol} ${action.market} action.`,
              tone: "ok",
              action,
              ...ev,
              sentToBroker: !frozen,
            }),
            ...(frozen ? [] : executedFollowups(action, ev)),
          ],
        });
      }
      if (frozen) return; // stay stopped — intent recorded, nothing continues
      // The reducer already recomputed status from the surviving pending queue:
      // resolving the last pending action drops the agent straight to IDLE (the
      // lab unlocks, Nova stops saying "Needs your OK"); if others remain it
      // stays parked. Here we only decide whether a paused scripted run that is
      // now clear continues on its own timer.
      if (wasScripted && !othersAwaiting) {
        schedule(() => advance(), 700);
      }
    },
    [advance, executedFollowups, guardEvidence, schedule, stampEvent]
  );

  const reject = useCallback(
    (eventId: string) => {
      const s = stateRef.current;
      const base = s.events.find((e) => e.id === eventId && e.action);
      if (!base || !base.action) return;
      const action = base.action;
      const frozen = stateRef.current.status === "stopped";
      const wasScripted = s.scripted;
      const othersAwaiting = pendingApprovals(s.events).some((e) => e.id !== eventId);
      const ev = guardEvidence(action, base.intent ?? "user", base.prompt);
      dispatch({
        type: "resolve-approval",
        eventId,
        result: "rejected",
        followup: [
          stampEvent({
            event: "rejected",
            actor: "You",
            summary: `You declined the ${action.symbol} action — nothing was sent.`,
            tone: "warn",
            action,
            ...ev,
            sentToBroker: false,
          }),
        ],
      });
      if (frozen) return; // stay stopped
      // Reducer recomputed status from the pending queue (IDLE when this was
      // the last row, parked while others remain) — only continue a now-clear
      // scripted run here.
      if (wasScripted && !othersAwaiting) {
        schedule(() => advance(), 700);
      }
    },
    [advance, guardEvidence, schedule, stampEvent]
  );

  /**
   * Run ONE proposed action through the real policy engine (Demo Mode only).
   * Covers quick-launch scenarios, the custom proposal composer and hostile
   * probes alike — the engine cannot tell them apart, only the `intent` label
   * on the audit row says where each came from. Also records `lastProposal`
   * so the user can edit the mandate and re-run the identical action to prove
   * the next verdict comes from the RULES, not a script.
   */
  const propose = useCallback(
    async (
      action: ProposedAction,
      opts: { intent?: IntentOrigin; prompt?: string } = {}
    ): Promise<ProposalOutcome | null> => {
      const intent: IntentOrigin = opts.intent ?? "user";
      const s0 = stateRef.current;
      if (s0.mode !== "demo") return null; // Live view is reference-only.
      clearTimers();
      const last: LastProposal = { action, intent, prompt: opts.prompt };
      dispatch({ type: "set-last-proposal", last });
      dispatch({ type: "set-script", scripted: false });
      dispatch({ type: "set-status", status: "proposing" });

      return new Promise<ProposalOutcome | null>((resolve) => {
        schedule(() => {
          const s = stateRef.current;
          const ev = guardEvidence(action, intent, opts.prompt);
          const decision = evaluateAction(s.policy, action, computeBook(s.events));

          if (decision.state === "blocked") {
            const row = stampEvent({
              event: "policy-decision",
              actor: AGENT_NAME,
              summary: summarizeDecision(action, decision),
              tone: "critical",
              action,
              checks: decision.checks,
              verdict: "blocked",
              reason: decision.blockedBy[0]?.detail,
              ...ev,
              sentToBroker: false,
            });
            dispatch({ type: "append", events: [row] });
            dispatch({ type: "set-status", status: "idle" });
            resolve({
              verdict: "blocked",
              reason: decision.blockedBy[0]?.detail,
              rule: decision.blockedBy[0]?.rule,
              eventId: row.id,
              policyVersion: ev.policyVersion,
              sentToBroker: false,
              blockedRules: decision.blockedBy.map((c) => c.rule),
              payload: ev.payload,
            });
            return;
          }

          if (decision.requiresApproval) {
            const row = stampEvent({
              event: "policy-decision",
              actor: AGENT_NAME,
              summary: summarizeDecision(action, decision),
              tone: "pending",
              action,
              checks: decision.checks,
              verdict: "approved",
              requiresApproval: true,
              approvalState: "awaiting",
              ...ev,
              sentToBroker: false,
            });
            dispatch({ type: "append", events: [row] });
            dispatch({ type: "set-status", status: "awaiting-approval" });
            resolve({
              verdict: "needs-ok",
              reason: decision.blockedBy[0]?.detail,
              eventId: row.id,
              policyVersion: ev.policyVersion,
              sentToBroker: false,
              blockedRules: [],
              payload: ev.payload,
            });
            return;
          }

          // Approved with no human gate → execute the simulated fill.
          const row = stampEvent({
            event: "policy-decision",
            actor: AGENT_NAME,
            summary: summarizeDecision(action, decision),
            tone: "ok",
            action,
            checks: decision.checks,
            verdict: "approved",
            ...ev,
            sentToBroker: true,
          });
          dispatch({
            type: "append",
            events: [row, ...executedFollowups(action, ev)],
          });
          dispatch({ type: "set-status", status: "idle" });
          resolve({
            verdict: "approved",
            reason: decision.blockedBy[0]?.detail,
            eventId: row.id,
            policyVersion: ev.policyVersion,
            sentToBroker: true,
            blockedRules: [],
            payload: ev.payload,
          });
        }, 550);
      });
    },
    [clearTimers, executedFollowups, guardEvidence, schedule, stampEvent]
  );

  /** Re-run the last single proposal — the "edit mandate, same action" proof. */
  const rerunLastProposal = useCallback(async (): Promise<ProposalOutcome | null> => {
    const s = stateRef.current;
    if (!s.lastProposal) return null;
    const { action, intent, prompt } = s.lastProposal;
    return propose(action, { intent, prompt });
  }, [propose]);

  const setPolicy = useCallback(
    (policy: Policy) => {
      const prev = stateRef.current.policy;
      // Compute the next version record NOW (pure) so the feed row and the
      // reducer's history entry always agree — even though stateRef only
      // catches up on the next render.
      const rec = nextPolicyRecord(prev, {
        ...policy,
        version: prev.version,
        updatedAt: policy.updatedAt,
      });
      const changed = rec.diff.length > 0;
      const version = changed ? rec.version : prev.version;
      dispatch({
        type: "set-policy",
        policy: { ...policy, version, updatedAt: policy.updatedAt },
      });
      dispatch({
        type: "append",
        events: [
          stampEvent({
            event: "policy-updated",
            actor: "You",
            summary: changed
              ? `Mandate updated to v${version} — “${policy.name}”. Every future action is checked against the new rules.`
              : `Mandate saved — no rules actually changed (still v${version}).`,
            tone: "info",
            detail: changed ? diffText(rec.diff) : undefined,
            policyVersion: version,
          }),
        ],
      });
    },
    [stampEvent]
  );

  const setMode = useCallback(
    (mode: Mode) => {
      dispatch({ type: "set-mode", mode });
      dispatch({
        type: "append",
        events: [
          stampEvent({
            event: "system",
            actor: "You",
            summary:
              mode === "live"
                ? "Live view is reference only — Mandate never connects from the web. Wire your own Binance Agent OS agent on your desktop; the policy gates below stay identical."
                : "Back to Demo Mode — the agent runs on the simulated broker.",
            tone: mode === "live" ? "warn" : "info",
            mode,
          }),
        ],
      });
    },
    [stampEvent]
  );

  const book = useMemo(() => computeBook(state.events), [state.events]);
  const exposureUsd = book.exposureUsd;
  const pending = useMemo(() => pendingApprovals(state.events), [state.events]);
  const lastDecision = useMemo(() => {
    const reversed = [...state.events].reverse();
    return (
      reversed.find((e) => e.event === "policy-decision" || e.event === "approved") ?? null
    );
  }, [state.events]);

  const api: AgentGuardApi = {
    state,
    hydrated,
    exposureUsd,
    book,
    pending,
    lastDecision,
    runDemo,
    resetDemo,
    stopAgent,
    resume,
    approve,
    reject,
    setPolicy,
    setMode,
    propose,
    rerunLastProposal,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
