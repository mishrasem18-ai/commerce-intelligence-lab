"use client";

import * as React from "react";
import { Activity, Trash2, X } from "lucide-react";
import { analytics } from "@/lib/analytics";
import { useConsentRecord } from "@/lib/analytics/use-consent";
import { useMounted } from "@/lib/use-mounted";
import type { AdapterDispatchStatus, DispatchRecord } from "@/lib/analytics/dispatcher";
import { cn } from "@/lib/utils";

/**
 * Development/training Analytics Debugger.
 *
 * Shows the CANONICAL analyticsData envelopes generated while browsing —
 * the vendor-agnostic data layer — plus each adapter's honest dispatch
 * status and, when delivered, how the adapter translated the canonical
 * event into vendor terms (e.g. GTM: mapped to "add_to_cart" on
 * window.dataLayer). It never pretends a vendor hit happened.
 *
 * Safety: it renders only the already-PII-scrubbed envelopes from the
 * dispatcher log. Passwords, cookies, session tokens and raw user records
 * never enter that log, so they can never be displayed. Hidden by default in
 * production behind an explicit footer toggle ("Analytics Debugger").
 */

const TOGGLE_EVENT = "aurora:analytics:toggle-debugger";

/** Toggle the debugger from anywhere (e.g. the footer link). */
export function toggleAnalyticsDebugger() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOGGLE_EVENT));
  }
}

const STATUS_STYLE: Record<AdapterDispatchStatus, string> = {
  delivered: "bg-success/15 text-success",
  blocked_by_consent: "bg-warning/20 text-warning-foreground",
  not_configured: "bg-muted text-muted-foreground",
  error: "bg-danger/15 text-danger",
};

const STATUS_LABEL: Record<AdapterDispatchStatus, string> = {
  delivered: "Delivered",
  blocked_by_consent: "Blocked by consent",
  not_configured: "Not configured",
  error: "Error",
};

function useDispatchLog(): readonly DispatchRecord[] {
  return React.useSyncExternalStore(
    (onStoreChange) => analytics.dispatcher.subscribe(onStoreChange),
    () => analytics.dispatcher.getLog(),
    () => analytics.dispatcher.getLog(),
  );
}

export function AnalyticsDebugger() {
  const mounted = useMounted();
  const [open, setOpen] = React.useState(false);
  const log = useDispatchLog();
  const consent = useConsentRecord();

  React.useEffect(() => {
    const onToggle = () => setOpen((prev) => !prev);
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle);
  }, []);

  if (!mounted || !open) return null;

  const adapters = analytics.dispatcher.listAdapters();
  const events = [...log].reverse(); // newest first

  return (
    <aside
      role="complementary"
      aria-label="Analytics debugger"
      className="fixed bottom-4 right-4 z-[80] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/25"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Activity className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Analytics Debugger
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          canonical layer: analyticsData
        </span>
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Clear events"
            onClick={() => analytics.dispatcher.clearLog()}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close debugger"
            onClick={() => setOpen(false)}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Consent + destination overview */}
      <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground">
            Analytics consent:{" "}
            <span
              className={cn(
                "font-semibold",
                consent.state.analytics ? "text-success" : "text-danger",
              )}
            >
              {consent.state.analytics ? "GRANTED" : "DENIED"}
            </span>
          </span>
          {adapters.map((adapter) => (
            <span key={adapter.name} className="text-muted-foreground">
              {adapter.label}:{" "}
              <span className="font-medium text-foreground/70">
                {adapter.isConfigured() ? "Configured" : "Not configured"}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          analyticsData (canonical, vendor-agnostic) → dispatcher → adapters.
          {adapters.some((a) => a.name === "gtm" && a.isConfigured()) && (
            <> GTM adapter → window.dataLayer → GTM container → GA4 (tags are
            configured inside the container).</>
          )}{" "}
          window.dataLayer is GTM output only — never the source of truth.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No events yet — browse the store to generate canonical events.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {events.map(({ event, results, piiViolations }) => (
              <li
                key={event.event_id}
                className="rounded-xl border border-border bg-background/60"
              >
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <code className="text-xs font-semibold text-foreground">
                      {event.event_name}
                    </code>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {event.timestamp.slice(11, 19)}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {event.page.page_type}
                    </span>
                    {piiViolations.length > 0 && (
                      <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                        PII redacted ×{piiViolations.length}
                      </span>
                    )}
                  </summary>
                  <div className="border-t border-border/70 px-3 py-2">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {results.map((result) => (
                        <span
                          key={result.adapter}
                          title={result.detail}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            STATUS_STYLE[result.status],
                          )}
                        >
                          {result.label}: {STATUS_LABEL[result.status]}
                          {result.status === "delivered" && result.detail
                            ? ` — ${result.detail}`
                            : ""}
                        </span>
                      ))}
                    </div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      analyticsData (canonical envelope)
                    </p>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted/60 p-2 text-[11px] leading-relaxed text-foreground/90">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Canonical analyticsData envelopes only — PII is redacted before events
        reach this log or any adapter. Vendor payloads (e.g. window.dataLayer)
        are derived from these envelopes inside adapters.
      </p>
    </aside>
  );
}
