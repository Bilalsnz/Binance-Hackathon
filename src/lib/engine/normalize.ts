import type { NormalizedCall, ProposedAction } from "./types";

/**
 * Normalize a proposed action into the tool-call-shaped payload Mandate
 * records as evidence and passes to its Guard API. It is a 1:1, lossless
 * projection of the action — nothing here invents fields the engine did not
 * see. The shape is Mandate's own normalized contract; a desktop
 * integration maps its agent's raw tool args into this shape BEFORE the
 * underlying Binance tool executes (see ARCHITECTURE.md for the boundary).
 */
export function normalizeToolCall(a: ProposedAction): NormalizedCall {
  return {
    kind: a.kind,
    market: a.market,
    symbol: a.symbol.toUpperCase(),
    side: a.side,
    notionalUsd: a.notionalUsd,
    estRiskUsd: a.estRiskUsd,
    intent: a.goal,
    params: {
      notionalUsd: a.notionalUsd,
      symbol: a.symbol.toUpperCase(),
      market: a.market,
      side: a.side,
    },
  };
}
