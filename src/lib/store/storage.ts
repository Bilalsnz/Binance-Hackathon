import type { AuditEvent } from "@/lib/engine/types";
import type { AppState } from "./state";

const KEY = "agentguard:v1";

/** Persisted slice of app state. */
export interface Persisted {
  mode: AppState["mode"];
  policy: AppState["policy"];
  events: AuditEvent[];
  scriptIndex: number;
  scriptDone: boolean;
}

export function persistState(state: AppState): void {
  if (typeof window === "undefined") return;
  const data: Persisted = {
    mode: state.mode,
    policy: state.policy,
    events: state.events,
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
    return {
      mode: data.mode ?? "demo",
      policy: data.policy,
      events: data.events,
      scriptIndex: data.scriptIndex ?? 0,
      scriptDone: data.scriptDone ?? false,
    };
  } catch {
    return null;
  }
}
