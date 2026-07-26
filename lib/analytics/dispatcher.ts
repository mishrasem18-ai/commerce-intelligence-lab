/**
 * Event dispatcher: canonical event → zero or more adapters.
 *
 * Guarantees:
 *  - Internal observation is unconditional: every canonical event lands in the
 *    in-memory log (debugger/training visibility) regardless of consent —
 *    external VENDOR dispatch is what consent gates. This separation is what
 *    prevents circular consent behaviour: `consent.update` itself is observable
 *    even while all analytics adapters are blocked.
 *  - Adapter failures are isolated: one throwing adapter is recorded as
 *    "error" and neither breaks commerce code (dispatch never throws) nor
 *    stops other adapters from receiving the event.
 *  - Honest status: unconfigured destinations report "not_configured" — the
 *    system never pretends a vendor event was sent.
 */

import type { AnalyticsEvent } from "@/lib/analytics/schema";
import type { ConsentState } from "@/lib/analytics/consent";
import type { AnalyticsAdapter } from "@/lib/analytics/adapters/types";

export type AdapterDispatchStatus =
  | "delivered"
  | "blocked_by_consent"
  | "not_configured"
  | "error";

export interface AdapterDispatchResult {
  adapter: string;
  label: string;
  status: AdapterDispatchStatus;
  detail?: string;
}

export interface DispatchRecord {
  event: AnalyticsEvent;
  results: AdapterDispatchResult[];
  /** Paths redacted by the PII guard while building the envelope. */
  piiViolations: string[];
}

export interface Dispatcher {
  dispatch(event: AnalyticsEvent, piiViolations?: string[]): DispatchRecord;
  register(adapter: AnalyticsAdapter): void;
  listAdapters(): AnalyticsAdapter[];
  /** Newest-last log of recent dispatches (bounded ring buffer). */
  getLog(): readonly DispatchRecord[];
  clearLog(): void;
  subscribe(listener: () => void): () => void;
}

const LOG_LIMIT = 200;

export function createDispatcher(options: {
  adapters?: AnalyticsAdapter[];
  getConsent: () => ConsentState;
}): Dispatcher {
  const adapters: AnalyticsAdapter[] = [];
  let log: DispatchRecord[] = [];
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* listener faults never propagate */
      }
    }
  };

  const register = (adapter: AnalyticsAdapter) => {
    adapters.push(adapter);
    try {
      if (adapter.isConfigured()) adapter.initialize?.();
    } catch {
      /* a failing initialize must not break registration of others */
    }
  };

  for (const adapter of options.adapters ?? []) register(adapter);

  const sendToAdapter = (
    adapter: AnalyticsAdapter,
    event: AnalyticsEvent,
    consent: ConsentState,
  ): AdapterDispatchResult => {
    const base = { adapter: adapter.name, label: adapter.label };
    try {
      if (!adapter.isConfigured()) {
        return { ...base, status: "not_configured" };
      }
      if (consent[adapter.consentCategory] !== true) {
        return {
          ...base,
          status: "blocked_by_consent",
          detail: `requires "${adapter.consentCategory}" consent`,
        };
      }
      adapter.track(event);
      return { ...base, status: "delivered" };
    } catch (error) {
      return {
        ...base,
        status: "error",
        detail: error instanceof Error ? error.message : "adapter failed",
      };
    }
  };

  return {
    dispatch(event, piiViolations = []) {
      let consent: ConsentState;
      try {
        consent = options.getConsent();
      } catch {
        // If consent can't be read, fail CLOSED for external destinations.
        consent = {
          necessary: true,
          analytics: false,
          advertising: false,
          personalization: false,
        };
      }
      const results = adapters.map((adapter) => sendToAdapter(adapter, event, consent));
      const record: DispatchRecord = { event, results, piiViolations };
      log = [...log.slice(-(LOG_LIMIT - 1)), record];
      notify();
      return record;
    },
    register,
    listAdapters: () => [...adapters],
    getLog: () => log,
    clearLog: () => {
      log = [];
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
