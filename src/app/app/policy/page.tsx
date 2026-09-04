"use client";

import { PolicyBuilder } from "@/components/policy/PolicyBuilder";

export default function PolicyPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="h-display text-2xl text-white">Policy builder</h1>
        <p className="mt-1 text-sm muted">
          Set the mandate {`Nova`} must obey. Every proposed action is checked against these rules
          by a deterministic engine — no opinions, no guesswork.
        </p>
      </header>
      <PolicyBuilder />
    </div>
  );
}
