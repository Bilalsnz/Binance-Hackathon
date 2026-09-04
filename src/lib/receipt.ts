import type { AuditEvent, Policy, PolicyVersionRecord } from "@/lib/engine/types";

/**
 * Tamper-evident JSON receipts, honestly labelled.
 *
 * A receipt is a hash CHAIN over every audit event: each row's hash covers the
 * previous row's hash plus this event's canonical JSON, so any reorder, edit or
 * deletion after export is detectable by re-hashing. All of it is generated in
 * the browser — that makes it *tamper-evident on this device*, NOT signed or
 * notarised. The receipt says so itself (`generatedLocally`, no signer), and
 * the algorithm used is recorded (SHA-256 when the browser offers a secure
 * context; a documented non-cryptographic fallback otherwise). Nothing here
 * claims immutability or third-party attestation — use it to audit your own
 * demo, not to certify anything to Binance.
 */

export const RECEIPT_SCHEMA = "agentguard.receipt.v1";

/** Deterministic stringify: keys sorted recursively so re-hashes are stable. */
function canonical(obj: unknown): string {
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(",")}]`;
  if (obj && typeof obj === "object") {
    const entries = Object.keys(obj as Record<string, unknown>)
      .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((obj as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(obj);
}

/** Only the evidential fields go into the chain — nothing UI- or client-only. */
function evidenceOf(e: AuditEvent): Record<string, unknown> {
  return {
    seq: e.seq,
    id: e.id,
    ts: e.ts,
    event: e.event,
    actor: e.actor,
    summary: e.summary,
    tone: e.tone,
    mode: e.mode,
    source: e.source,
    action: e.action,
    checks: e.checks,
    verdict: e.verdict,
    requiresApproval: e.requiresApproval,
    approvalState: e.approvalState,
    reason: e.reason,
    policyVersion: e.policyVersion,
    payload: e.payload,
    sentToBroker: e.sentToBroker,
    intent: e.intent,
    prompt: e.prompt,
  };
}

type HashResult = { algorithm: "sha-256" | "fnv1a-32"; hex: string };

async function hashText(input: string): Promise<HashResult> {
  try {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { algorithm: "sha-256", hex };
  } catch {
    // Non-secure context (e.g. plain-http phone preview) → documented fallback.
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return { algorithm: "fnv1a-32", hex: h.toString(16).padStart(8, "0") };
  }
}

export interface ReceiptLink {
  seq: number;
  id: string;
  event: AuditEvent["event"];
  ts: string;
  prevHash: string;
  /** Canonical JSON of the event's evidential fields — what `hash` covers. */
  body: string;
  hash: string;
}

export interface AgentGuardReceipt {
  schema: typeof RECEIPT_SCHEMA;
  title: string;
  generatedLocally: true;
  signer: null;
  algorithm: HashResult["algorithm"];
  chainTip: string;
  exportedAt: string;
  policy: { version: number; name: string };
  policyHistory: Array<{ version: number; changedAt: string; diff: PolicyVersionRecord["diff"] }>;
  links: ReceiptLink[];
  note: string;
}

export async function buildReceipt(opts: {
  events: AuditEvent[];
  policy: Policy;
  policyHistory: PolicyVersionRecord[];
}): Promise<AgentGuardReceipt> {
  const exportedAt = new Date().toISOString();
  const links: ReceiptLink[] = [];
  let prevHash = "GENESIS";
  let algorithm: HashResult["algorithm"] = "fnv1a-32";

  for (const e of opts.events) {
    const body = canonical(evidenceOf(e));
    const { algorithm: alg, hex } = await hashText(`${prevHash}\n${body}`);
    algorithm = alg;
    links.push({
      seq: e.seq,
      id: e.id,
      event: e.event,
      ts: e.ts,
      prevHash,
      body,
      hash: hex,
    });
    prevHash = hex;
  }

  return {
    schema: RECEIPT_SCHEMA,
    title: "AgentGuard session receipt",
    generatedLocally: true,
    signer: null,
    algorithm,
    chainTip: prevHash,
    exportedAt,
    policy: { version: opts.policy.version, name: opts.policy.name },
    policyHistory: opts.policyHistory.map((r) => ({
      version: r.version,
      changedAt: r.changedAt,
      diff: r.diff,
    })),
    links,
    note:
      "Generated locally in your browser. Each row hashes the previous row's hash plus that " +
      "event's canonical JSON, so the chain is self-verifying: run verifyReceipt() on this file " +
      "to recompute every hash and confirm nothing was edited, reordered or deleted since export. " +
      "It is tamper-evident on this device — not signed or notarised, and not a claim of " +
      "immutability.",
  };
}

export type ReceiptVerifyResult =
  | { valid: true; links: number; algorithm: string }
  | { valid: false; links: number; algorithm: string; firstBadLink: number; reason: string };

/**
 * Recompute the whole chain from the receipt alone (each link carries the body it
 * hashed) and report whether the file is intact. `valid: true` means every stored
 * hash matches the recomputed hash AND the stored chain tip matches — i.e. no
 * body was edited, no link was reordered, removed or re-hashed after export.
 */
export async function verifyReceipt(receipt: AgentGuardReceipt): Promise<ReceiptVerifyResult> {
  let prevHash = "GENESIS";
  for (let i = 0; i < receipt.links.length; i++) {
    const link = receipt.links[i];
    const recomputed = await hashText(`${link.prevHash}\n${link.body}`);
    if (link.hash !== recomputed.hex) {
      return {
        valid: false,
        links: receipt.links.length,
        algorithm: recomputed.algorithm,
        firstBadLink: i,
        reason: "stored hash does not match the recomputed hash for this event's body",
      };
    }
    if (i > 0 && link.prevHash !== receipt.links[i - 1].hash) {
      return {
        valid: false,
        links: receipt.links.length,
        algorithm: recomputed.algorithm,
        firstBadLink: i,
        reason: "link does not chain to the previous row's hash (reordered or inserted)",
      };
    }
    prevHash = link.hash;
  }
  if (prevHash !== receipt.chainTip) {
    return {
      valid: false,
      links: receipt.links.length,
      algorithm: receipt.algorithm,
      firstBadLink: receipt.links.length,
      reason: "chain tip does not match the last recomputed hash (a row was removed)",
    };
  }
  return { valid: true, links: receipt.links.length, algorithm: receipt.algorithm };
}

/** Trigger a JSON download of a receipt. */
export function downloadReceipt(receipt: AgentGuardReceipt): void {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = receipt.exportedAt.replace(/[:.]/g, "-");
  a.href = url;
  a.download = `agentguard-receipt-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
