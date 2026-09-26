"use client";

import { ConsentManager } from "@/components/analytics/consent-manager";
import { AnalyticsDebugger } from "@/components/analytics/analytics-debugger";

/**
 * Storefront analytics UI: the consent banner/preferences and the training
 * debugger. Rendered once from the (store) layout; renders no visible UI of
 * its own. Canonical page views are tracked for every route by RootAnalytics
 * in the root layout.
 */
export function AnalyticsRuntime() {
  return (
    <>
      <ConsentManager />
      <AnalyticsDebugger />
    </>
  );
}
