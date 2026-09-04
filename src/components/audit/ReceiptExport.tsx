"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useAgentGuard } from "@/lib/store/AgentGuardProvider";
import { buildReceipt, downloadReceipt } from "@/lib/receipt";
import { Btn } from "@/components/ui";

/**
 * "Export receipt" — downloads the whole session ledger as a tamper-evident
 * JSON receipt. The chain is hashed in the browser and the file honestly says
 * it was generated locally (not signed / not notarised). Re-hashing the export
 * detects edits after download; it does not claim immutability.
 */
export function ReceiptExport() {
  const { state } = useAgentGuard();
  const [busy, setBusy] = useState(false);
  const hasEvents = state.events.length > 0;

  const doExport = async () => {
    if (!hasEvents) return;
    setBusy(true);
    try {
      // Hash chain reads oldest → newest; the audit page displays newest first.
      const ordered = [...state.events].sort((a, b) => a.seq - b.seq);
      const receipt = await buildReceipt({
        events: ordered,
        policy: state.policy,
        policyHistory: state.policyHistory,
      });
      downloadReceipt(receipt);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Btn variant="ghost" onClick={doExport} disabled={busy || !hasEvents}>
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {busy ? "Hashing…" : "Export receipt"}
    </Btn>
  );
}
