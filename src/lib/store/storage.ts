import type { AuditEvent, PolicyVersionRecord } from "@/lib/engine/types";
import { normalizePolicy } from "@/lib/engine/defaults";
import type { AppState } from "./state";

const KEY = "agentguard:v1";

/** Persisted slice of app state. */
export interface Persisted {
  mode: AppState["mode"];
  policy: AppState["policy"];
  events: AuditEvent[];
  policyHistory: PolicyVersionRecord[];
  scriptIndex: number;
  scriptDone: boolean;
}

function isVersionRecord(v: unknown): v is PolicyVersionRecord {
  const r = v as PolicyVersionRecord | null | undefined;
  return (
    !!r &&
    typeof r.version === "number" &&
    Array.isArray(r.diff) &&
    !!r.policy &&
    typeof r.changedAt === "string"
  );
}

export function persistState(state: AppState): void {
  if (typeof window === "undefined") return;
  const data: Persisted = {
    mode: state.mode,
    policy: state.policy,
    events: state.events,
    policyHistory: state.policyHistory,
    scriptIndex: state.scriptIndex,
    scriptDone: state.scriptDone,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full / private mode — demo still works in memory */
  }
}

export function loadPersisted(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    if (!data || !Array.isArray(data.events) || !data.policy) return null;

    // Migrate policies saved before the v2 guardrail fields existed — the
    // engine fills defaults for anything missing so an old mandate never
    // silently blocks every buy (or leaks an `undefined` into a reason).
    const policy = normalizePolicy(data.policy);

    let policyHistory = Array.isArray(data.policyHistory)
      ? data.policyHistory.filter(isVersionRecord)
      : [];
    // No recorded history yet? Seed a v1 baseline so the Policy page can show
    // "current vN" diff-against-default even on the very first session.
    if (policyHistory.length === 0) {
      policyHistory = [
        { version: policy.version, changedAt: policy.updatedAt, policy, diff: [] },
      ];
    }

    return {
      mode: data.mode ?? "demo",
      policy,
      events: data.events,
      policyHistory,
      scriptIndex: data.scriptIndex ?? 0,
      scriptDone: data.scriptDone ?? false,
    };
  } catch {
    return null;
  }
}
