"use client";

import type { AgentStatus, Tone } from "@/lib/engine/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---- Tone mapping ------------------------------------------------------ */

export function toneChip(tone: Tone): string {
  switch (tone) {
    case "ok":
      return "chip-ok";
    case "critical":
      return "chip-critical";
    case "pending":
    case "warn":
      return "chip-pending";
    case "violet":
      return "chip-violet";
    default:
      return "chip-info";
  }
}

export function toneText(tone: Tone): string {
  switch (tone) {
    case "ok":
      return "text-emerald-300";
    case "critical":
      return "text-rose-300";
    case "pending":
    case "warn":
      return "text-amber-300";
    case "violet":
      return "text-violet-300";
    default:
      return "text-cyan-300";
  }
}

/* ---- Agent status ------------------------------------------------------ */

const STATUS_META: Record<AgentStatus, { label: string; tone: Tone; dot: string }> = {
  idle: { label: "Idle", tone: "info", dot: "bg-slate-400" },
  running: { label: "Running", tone: "info", dot: "bg-cyan-400 animate-pulse" },
  researching: { label: "Researching", tone: "info", dot: "bg-cyan-400 animate-pulse" },
  proposing: { label: "Proposing", tone: "violet", dot: "bg-violet-400 animate-pulse" },
  "awaiting-approval": { label: "Needs approval", tone: "pending", dot: "bg-amber-400 animate-pulse" },
  stopped: { label: "Emergency stop", tone: "critical", dot: "bg-rose-500" },
};

export function agentStatusMeta(status: AgentStatus) {
  return STATUS_META[status];
}

/* ---- Small atoms ------------------------------------------------------- */

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("chip", toneChip(tone), className)}>{children}</span>
  );
}

export function Btn({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ok" | "danger" | "ghost" | "outline-danger";
}) {
  const styles = {
    primary: "btn-primary",
    ok: "btn-ok",
    danger: "btn-danger",
    ghost: "btn-ghost",
    "outline-danger": "btn-outline-danger",
  }[variant];
  return (
    <button
      className={cn("btn", styles, className)}
      type="button"
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  icon,
  hint,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("row mb-3 justify-between", className)}>
      <div className="row text-sm font-semibold text-slate-200">
        {icon}
        <span>{children}</span>
      </div>
      {hint ? <span className="text-xs muted">{hint}</span> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  accent = "cyan",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  accent?: "cyan" | "rose" | "amber";
}) {
  const colors = {
    cyan: "bg-gradient-to-r from-cyan-400 to-violet-500",
    rose: "bg-gradient-to-r from-rose-500 to-rose-600",
    amber: "bg-gradient-to-r from-amber-400 to-orange-500",
  }[accent];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="row justify-between gap-3"
    >
      {label ? <span className="text-sm text-slate-200">{label}</span> : null}
      <span
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
          checked ? colors : "bg-white/10 ring-1 ring-white/15"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </span>
    </button>
  );
}

export function Empty({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon ? <div className="text-slate-600">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {body ? <p className="max-w-[26ch] text-xs muted">{body}</p> : null}
    </div>
  );
}

/** Tiny stat tile used on the dashboard. */
export function Stat({
  label,
  value,
  icon,
  tone = "info",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card card-pad">
      <div className="row justify-between">
        <span className="label">{label}</span>
        {icon ? <span className={cn("opacity-80", toneText(tone))}>{icon}</span> : null}
      </div>
      <div className={cn("mt-2 text-xl font-bold tracking-tight", toneText(tone))}>
        {value}
      </div>
    </div>
  );
}
