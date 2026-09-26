/**
 * Central application-facing analytics service — the producer of the
 * canonical analyticsData layer.
 *
 * Business/UI code calls exactly one API — `analytics.track(name, payload)` —
 * and never touches window.dataLayer, gtag, vendor SDKs or adapters. Each
 * call assembles a FRESH `AnalyticsData` envelope (id, timestamp,
 * page/user/consent/app context) — never mutating a shared global, so stale
 * page/product/cart/user data cannot leak between events — scrubs PII, and
 * hands the envelope to the dispatcher.
 *
 * `track` NEVER throws: an analytics failure must never break add-to-cart,
 * checkout or navigation.
 */

import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsData,
  type AnalyticsEventName,
  type AppContext,
  type EventPayloadMap,
  type PageContext,
  type UserContext,
} from "@/lib/analytics/schema";
import {
  createConsentStore,
  type ConsentCategory,
  type ConsentRecord,
  type ConsentStore,
} from "@/lib/analytics/consent";
import { scrubPii } from "@/lib/analytics/pii";
import { resolvePageContext } from "@/lib/analytics/page-context";
import {
  createDispatcher,
  type Dispatcher,
  type DispatchRecord,
} from "@/lib/analytics/dispatcher";
import type { AnalyticsAdapter } from "@/lib/analytics/adapters/types";

export interface AnalyticsService {
  track<N extends AnalyticsEventName>(
    name: N,
    ...payload: Record<string, never> extends EventPayloadMap[N]
      ? [EventPayloadMap[N]?]
      : [EventPayloadMap[N]]
  ): DispatchRecord | null;
  /** Update the non-PII identity context attached to subsequent events. */
  setUserContext(context: UserContext): void;
  getUserContext(): UserContext;
  /**
   * Apply a consent decision AND emit the canonical `consent.update` event in
   * one step (the event carries the post-decision state).
   */
  updateConsent(
    method: "accept_all" | "reject_all" | "custom",
    preferences?: Partial<Record<ConsentCategory, boolean>>,
  ): ConsentRecord;
  readonly consent: ConsentStore;
  readonly dispatcher: Dispatcher;
}

function defaultCreateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to manual id */
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultPageContext(): PageContext {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { path: "", title: "", page_type: "other", query_string: "" };
  }
  const page = resolvePageContext(
    window.location.pathname,
    window.location.search.replace(/^\?/, ""),
  );
  // Title comes from the shared route table (never the racy DOM). Only an
  // entity page that has not registered its title yet falls back to the DOM
  // — page.view itself never does (the tracker waits instead).
  return { ...page, title: page.title ?? document.title };
}

function defaultEnvironment(): AppContext["environment"] {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export interface CreateAnalyticsOptions {
  adapters?: AnalyticsAdapter[];
  consentStore?: ConsentStore;
  getPageContext?: () => PageContext;
  environment?: AppContext["environment"];
  now?: () => string;
  createId?: () => string;
  /** Called with redacted paths when the PII guard fires (dev warning). */
  onPiiViolation?: (eventName: string, violations: string[]) => void;
}

export function createAnalytics(options: CreateAnalyticsOptions = {}): AnalyticsService {
  const consent = options.consentStore ?? createConsentStore();
  const dispatcher = createDispatcher({
    adapters: options.adapters ?? [],
    getConsent: () => consent.getState(),
  });
  // Vendor consent signalling: adapters learn the persisted state at startup
  // and every change thereafter (independent of event gating — see
  // Dispatcher.notifyConsent). Failures here must never break the app.
  try {
    dispatcher.notifyConsent(consent.getState());
  } catch {
    /* ignore */
  }
  consent.subscribe((record) => dispatcher.notifyConsent(record.state));

  const getPageContext = options.getPageContext ?? defaultPageContext;
  const environment = options.environment ?? defaultEnvironment();
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? defaultCreateId;

  let user: UserContext = { authentication_state: "guest" };

  const track = ((
    name: AnalyticsEventName,
    payload: Partial<Pick<AnalyticsData, "commerce" | "search" | "consent_change">> & {
      page?: Partial<PageContext>;
    } = {},
  ) => {
    try {
      const envelope: AnalyticsData = {
        event_name: name,
        event_id: createId(),
        timestamp: now(),
        schema_version: ANALYTICS_SCHEMA_VERSION,
        page: { ...getPageContext(), ...payload.page },
        user: { ...user },
        consent: consent.getState(),
        app: { name: "aurora-market", environment },
        ...(payload.commerce ? { commerce: payload.commerce } : {}),
        ...(payload.search ? { search: payload.search } : {}),
        ...(payload.consent_change ? { consent_change: payload.consent_change } : {}),
      };
      const { value: scrubbed, violations } = scrubPii(envelope);
      if (violations.length > 0) options.onPiiViolation?.(name, violations);
      return dispatcher.dispatch(scrubbed, violations);
    } catch {
      // Analytics must never break the application.
      return null;
    }
  }) as AnalyticsService["track"];

  return {
    track,
    setUserContext: (context) => {
      // Only the two whitelisted identity fields can ever be attached.
      user = {
        authentication_state: context.authentication_state,
        ...(context.customer_id ? { customer_id: context.customer_id } : {}),
      };
    },
    getUserContext: () => ({ ...user }),
    updateConsent: (method, preferences) => {
      const record =
        method === "accept_all"
          ? consent.acceptAll()
          : method === "reject_all"
            ? consent.rejectAll()
            : consent.setPreferences(preferences ?? {});
      track("consent.update", {
        consent_change: { method, categories: record.state },
      });
      return record;
    },
    consent,
    dispatcher,
  };
}
