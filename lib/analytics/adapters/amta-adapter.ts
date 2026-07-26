/**
 * AMTA Lab adapter — PLACEHOLDER (Phase 2).
 *
 * AMTA Lab is the author's OWN educational analytics platform (simulated
 * Adobe-style capabilities built from scratch — NOT Adobe Analytics, Launch,
 * AEP, Web SDK or any actual Adobe product, none of which are integrated).
 *
 * Its transport is intentionally undecided (HTTP collector, browser SDK or a
 * tag-manager-style integration are all possible); the canonical envelope is
 * vendor-independent enough that AMTA can map the same business events into
 * its educational Adobe-style concepts later without touching application
 * code. Until an endpoint exists, `isConfigured()` is false and no network
 * request is ever made or faked.
 */

import type { AnalyticsAdapter } from "@/lib/analytics/adapters/types";

export function createAmtaAdapter(): AnalyticsAdapter {
  return {
    name: "amta",
    label: "AMTA Lab",
    consentCategory: "analytics",
    isConfigured: () => false,
    track: () => {
      // Phase 2: deliver the canonical envelope to the AMTA Lab collector.
    },
  };
}
