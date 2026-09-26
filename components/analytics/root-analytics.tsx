"use client";

import { PageViewTracker } from "@/components/analytics/page-view-tracker";

/**
 * Canonical page views for EVERY route (store, admin, 404), mounted once in
 * the root layout after the page content. The consent UI and the training
 * debugger stay storefront-only (AnalyticsRuntime in the (store) layout);
 * consent itself is global persisted state, so admin/404 page views are
 * gated exactly like storefront ones.
 *
 * Deliberately NOT wrapped in <Suspense>: React hydrates a dehydrated
 * Suspense boundary in a later pass than the root, so a wrapped tracker
 * would emit page.view AFTER a hard-loaded page's own effects (view_item
 * first). Without the boundary it hydrates in the same pass as the page.
 * useSearchParams needs no boundary here because every route is dynamically
 * rendered (the root layout is force-dynamic); if that ever changes,
 * `next build` fails with "missing Suspense with CSR bailout" rather than
 * silently reordering events.
 */
export function RootAnalytics() {
  return <PageViewTracker />;
}
