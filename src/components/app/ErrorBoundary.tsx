"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defense: if a screen throws during render, show a visible,
 * recoverable card instead of letting React unmount to a blank page (or, worse,
 * leaving stale server HTML that looks frozen). Errors are logged so they are
 * diagnosable from the browser console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Mandate] render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-center">
          <p className="font-display text-lg font-bold text-white">
            Something went wrong on this screen
          </p>
          <p className="mx-auto mt-2 max-w-sm break-words text-xs text-rose-200/80">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
