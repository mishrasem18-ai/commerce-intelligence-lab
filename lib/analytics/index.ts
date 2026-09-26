/**
 * Aurora Market analytics — application entry point.
 *
 * Import `analytics` from here in business/UI code:
 *
 *   import { analytics } from "@/lib/analytics";
 *   analytics.track("commerce.add_to_cart", { commerce: ... });
 *
 * Every `track` call produces a fresh canonical `AnalyticsData` envelope —
 * the vendor-agnostic analyticsData layer that adapters (GTM →
 * window.dataLayer → GA4, Contentsquare, AMTA Lab) consume. Components never
 * see vendor APIs.
 *
 * The singleton is module-scoped, so every component shares one dispatcher,
 * one consent store and one event log. On the server it exists but is inert
 * (no storage, empty page context); all real tracking happens client-side.
 */

import { createAnalytics, type AnalyticsService } from "@/lib/analytics/analytics";
import { createGtmAdapter } from "@/lib/analytics/adapters/gtm-adapter";
import { createContentsquareAdapter } from "@/lib/analytics/adapters/contentsquare-adapter";
import { createAmtaAdapter } from "@/lib/analytics/adapters/amta-adapter";
import { installAnalyticsDataInspector } from "@/lib/analytics/inspector";
import { createSearchTracker, documentEntry } from "@/lib/analytics/search";

export const analytics: AnalyticsService = createAnalytics({
  adapters: [createGtmAdapter(), createContentsquareAdapter(), createAmtaAdapter()],
  onPiiViolation: (eventName, violations) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[analytics] PII redacted from "${eventName}":`,
        violations.join(", "),
      );
    }
  },
});

/**
 * Site search: call `searchTracker.submit(term, resultsCount, source,
 * revision)` on a deliberate search, `searchTracker.expectNavigation(url)`
 * before an in-app navigation to a ?q= URL, and `searchTracker.landed(url,
 * term, count)` when the shop renders a ?q= URL with its final results. The
 * tracker owns every dedupe rule, so exactly one canonical search.submit is
 * produced per deliberate search.
 */
export const searchTracker = createSearchTracker({
  track: (search) => analytics.track("search.submit", { search }),
  entry: documentEntry,
  currentUrl: () =>
    typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`,
  storage: () => (typeof window === "undefined" ? null : window.sessionStorage),
});

// Educational-lab inspector: `window.analyticsData` in DevTools returns a
// read-only, deep-frozen snapshot of the canonical layer (see inspector.ts).
// Browser only — the server singleton stays headless.
installAnalyticsDataInspector(analytics);

export type { AnalyticsService } from "@/lib/analytics/analytics";
export type {
  AnalyticsData,
  AnalyticsEventName,
  CommerceContext,
  CommerceItem,
  PageType,
  SearchContext,
  SearchSource,
} from "@/lib/analytics/schema";
export type { ConsentCategory, ConsentRecord, ConsentState } from "@/lib/analytics/consent";
export type { DispatchRecord } from "@/lib/analytics/dispatcher";
