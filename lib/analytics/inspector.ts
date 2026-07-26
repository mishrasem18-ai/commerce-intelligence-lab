/**
 * window.analyticsData — read-only DevTools inspector for the canonical layer.
 *
 * Aurora Market is an educational analytics lab, so the canonical
 * vendor-agnostic analyticsData layer must be INSPECTABLE from the browser
 * console. This module exposes `window.analyticsData` as a GETTER that
 * builds a fresh, deep-frozen SNAPSHOT of canonical state on every access:
 *
 *   - It represents the canonical contract only: recent `AnalyticsData`
 *     envelopes (already PII-scrubbed), the neutral consent state, the
 *     non-PII user context, and adapter/destination metadata.
 *   - It is NOT window.dataLayer and never aliases it. window.dataLayer is
 *     the GTM adapter's vendor-specific OUTPUT; this is the upstream truth.
 *   - No GTM/GA4/Adobe/Contentsquare payload structures appear here —
 *     vendor translation happens strictly inside adapters.
 *   - It is read-only by construction: every access returns a fresh
 *     deep-frozen COPY, and the window property has no setter, so nothing a
 *     user does to it can reach or mutate internal analytics state.
 *
 * Application code must never read from or write to window.analyticsData —
 * tracking always goes through `analytics.track()`.
 */

import { ANALYTICS_SCHEMA_VERSION, type AnalyticsData } from "@/lib/analytics/schema";
import type { ConsentState } from "@/lib/analytics/consent";
import type { UserContext } from "@/lib/analytics/schema";
import type { AnalyticsService } from "@/lib/analytics/analytics";

/** How many recent canonical envelopes the inspector exposes. */
const INSPECTOR_EVENT_LIMIT = 20;

export interface AnalyticsDataSnapshot {
  contract: "analyticsData";
  description: string;
  schema_version: string;
  consent: ConsentState;
  user: UserContext;
  destinations: Array<{
    name: string;
    label: string;
    consent_category: string;
    configured: boolean;
  }>;
  event_count: number;
  last_event: AnalyticsData | null;
  events: AnalyticsData[];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Plain-JSON deep copy — envelopes are serializable by construction. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Build a fresh, deep-frozen snapshot of the canonical analytics state.
 * Copies everything, so neither freezing nor user tampering can touch the
 * service's internal log/state.
 */
export function buildAnalyticsDataSnapshot(
  service: AnalyticsService,
): AnalyticsDataSnapshot {
  const log = service.dispatcher.getLog();
  const recent = log.slice(-INSPECTOR_EVENT_LIMIT).map((record) => copy(record.event));
  return deepFreeze({
    contract: "analyticsData" as const,
    description:
      "Aurora Market's canonical, vendor-agnostic analytics data layer " +
      "(read-only snapshot). Distinct from window.dataLayer, which is the " +
      "GTM adapter's Google-specific output. PII is redacted before events " +
      "enter this layer.",
    schema_version: ANALYTICS_SCHEMA_VERSION,
    consent: copy(service.consent.getState()),
    user: copy(service.getUserContext()),
    destinations: service.dispatcher.listAdapters().map((adapter) => ({
      name: adapter.name,
      label: adapter.label,
      consent_category: adapter.consentCategory,
      configured: adapter.isConfigured(),
    })),
    event_count: log.length,
    last_event: recent.length > 0 ? recent[recent.length - 1] : null,
    events: recent,
  });
}

/**
 * Define `window.analyticsData` as a getter-only property. Assignments are
 * ignored (non-strict) or throw (strict); the returned snapshot is deep-
 * frozen, so DevTools users can inspect but never mutate canonical state.
 */
export function installAnalyticsDataInspector(
  service: AnalyticsService,
  target: object | null = typeof window === "undefined" ? null : window,
): void {
  if (!target) return;
  try {
    Object.defineProperty(target, "analyticsData", {
      configurable: true, // allows dev-time HMR re-install
      enumerable: false,
      get: () => buildAnalyticsDataSnapshot(service),
    });
  } catch {
    /* an inspector failure must never break the app */
  }
}
