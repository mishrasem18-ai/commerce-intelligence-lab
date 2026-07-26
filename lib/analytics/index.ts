/**
 * Aurora Market analytics — application entry point.
 *
 * Import `analytics` from here in business/UI code:
 *
 *   import { analytics } from "@/lib/analytics";
 *   analytics.track("commerce.add_to_cart", { commerce: ... });
 *
 * The singleton is module-scoped, so every component shares one dispatcher,
 * one consent store and one event log. On the server it exists but is inert
 * (no storage, empty page context); all real tracking happens client-side.
 */

import { createAnalytics, type AnalyticsService } from "@/lib/analytics/analytics";
import { createGtmAdapter } from "@/lib/analytics/adapters/gtm-adapter";
import { createContentsquareAdapter } from "@/lib/analytics/adapters/contentsquare-adapter";
import { createAmtaAdapter } from "@/lib/analytics/adapters/amta-adapter";

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

export type { AnalyticsService } from "@/lib/analytics/analytics";
export type {
  AnalyticsEvent,
  AnalyticsEventName,
  CommerceContext,
  CommerceItem,
  PageType,
} from "@/lib/analytics/schema";
export type { ConsentCategory, ConsentRecord, ConsentState } from "@/lib/analytics/consent";
export type { DispatchRecord } from "@/lib/analytics/dispatcher";
