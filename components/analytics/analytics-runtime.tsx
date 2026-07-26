"use client";

import { Suspense } from "react";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ConsentManager } from "@/components/analytics/consent-manager";
import { AnalyticsDebugger } from "@/components/analytics/analytics-debugger";

/**
 * Mounts the storefront analytics runtime: SPA-safe page views, the consent
 * banner/preferences UI and the training debugger. Rendered once from the
 * (store) layout; renders no visible UI of its own.
 *
 * The Suspense boundary is required: useSearchParams inside PageViewTracker
 * would otherwise fail the production build on statically rendered routes.
 */
export function AnalyticsRuntime() {
  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <ConsentManager />
      <AnalyticsDebugger />
    </>
  );
}
