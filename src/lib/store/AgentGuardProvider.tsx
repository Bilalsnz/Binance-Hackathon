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
  computeExposure,
  pendingApprovals,
  type AppState,
  type Mode,
} from "./state";
import type {
  AuditEvent,
  Decision,
  Policy,
  ProposedAction,
} from "@/lib/engine/types";
import { evaluateAction } from "@/lib/engine/policy";
import { AGENT_NAME, DEMO_SCRIPT, type DemoScriptStep } from "@/lib/demo/script";
import { quoteToUsd } from "@/lib/demo/quotes";
import { isoNow, mkEvent, summarizeDecision, uid } from "./events";
import { loadPersisted, persistState } from "./storage";

interface AgentGuardApi {
  state: AppState;
  hydrated: boolean;
  exposureUsd: number;
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
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) dispatch({ type: "hydrate", patch: persisted });
    setHydrated(true);
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

  /** Follow-on events that mark a decision as executed in the demo wallet. */
  const executedFollowups = useCallback(
    (action: ProposedAction): AuditEvent[] => [
      stampEvent({
        event: "executed",
        actor: "Demo broker",
        summary: `Demo fill — ${action.side} ${action.symbol} at market. Simulated.`,
        tone: "ok",
        action,
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
    if (s.status === "stopped" || s.status === "awaiting-approval") return;
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

    // Action step — run it through the real policy engine.
    dispatch({ type: "set-status", status: "proposing" });
    const action = actionFromStep(step);
    const s2 = stateRef.current;
    const decision: Decision = evaluateAction(
      s2.policy,
      action,
      computeExposure(s2.events)
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
        }),
        ...executedFollowups(action),
      ],
    });
    schedule(() => advance(), 1500);
  }, [actionFromStep, executedFollowups, finishRun, schedule, stampEvent]);

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

      // Re-check against the *current* policy in case it changed while waiting.
      const decision = evaluateAction(
        s.policy,
        action,
        computeExposure(s.events)
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
            }),
            ...(frozen ? [] : executedFollowups(action)),
          ],
        });
      }
      if (!frozen) schedule(() => advance(), 700);
    },
    [advance, executedFollowups, schedule, stampEvent]
  );

  const reject = useCallback(
    (eventId: string) => {
      const s = stateRef.current;
      const base = s.events.find((e) => e.id === eventId && e.action);
      if (!base || !base.action) return;
      const action = base.action;
      const frozen = stateRef.current.status === "stopped";
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
          }),
        ],
      });
      if (!frozen) schedule(() => advance(), 700);
    },
    [advance, schedule, stampEvent]
  );

  const setPolicy = useCallback(
    (policy: Policy) => {
      dispatch({ type: "set-policy", policy });
      dispatch({
        type: "append",
        events: [
          stampEvent({
            event: "policy-updated",
            actor: "You",
            summary: `Mandate updated — “${policy.name}”. Every future action is checked against the new rules.`,
            tone: "info",
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
                ? "Switched to Live view — AgentGuard is connected to a real agent interface. No live order is placed without your approval."
                : "Back to Demo Mode — the agent runs on the simulated broker.",
            tone: mode === "live" ? "warn" : "info",
            mode,
          }),
        ],
      });
    },
    [stampEvent]
  );

  const exposureUsd = useMemo(() => computeExposure(state.events), [state.events]);
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
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
