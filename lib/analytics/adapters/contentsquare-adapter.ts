/**
 * Contentsquare adapter — PLACEHOLDER (Phase 2).
 *
 * No Contentsquare script/project is configured; `isConfigured()` is false and
 * the dispatcher reports "not_configured". Phase 2 will load the tag and map
 * canonical events to Contentsquare custom variables / dynamic variables here.
 */

import type { AnalyticsAdapter } from "@/lib/analytics/adapters/types";

export function createContentsquareAdapter(): AnalyticsAdapter {
  return {
    name: "contentsquare",
    label: "Contentsquare",
    consentCategory: "analytics",
    isConfigured: () => false,
    track: () => {
      // Phase 2: translate the canonical envelope to Contentsquare API calls.
    },
  };
}
