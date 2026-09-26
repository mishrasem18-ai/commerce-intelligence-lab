"use client";

import { Suspense } from "react";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";

/**
 * Canonical page views for EVERY route (store, admin, 404), mounted once in
 * the root layout after the page content. The consent UI and the training
 * debugger stay storefront-only (AnalyticsRuntime in the (store) layout);
 * consent itself is global persisted state, so admin/404 page views are
 * gated exactly like storefront ones.
 *
 * The Suspense boundary is required: useSearchParams inside PageViewTracker
 * would otherwise fail the production build on statically rendered routes.
 */
export function RootAnalytics() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
