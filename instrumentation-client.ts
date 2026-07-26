/**
 * Next.js client instrumentation (runs before hydration).
 *
 * Records the router transition type ("push" | "replace" | "traverse") and
 * target URL on a window marker BEFORE each navigation commits. The canonical
 * PageViewTracker reads it to distinguish real navigations from same-page
 * `router.replace` state refinements (shop search/filter/sort/pagination), so
 * one logical navigation can never produce more than one canonical page.view.
 *
 * Deliberately tiny (Next warns if client instrumentation exceeds ~16ms) and
 * vendor-neutral: no tracking happens here — only a marker for the canonical
 * layer. See lib/analytics/navigation.ts.
 */

import { NAVIGATION_MARKER_KEY } from "@/lib/analytics/navigation";

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
): void {
  try {
    (window as unknown as Record<string, unknown>)[NAVIGATION_MARKER_KEY] = {
      url,
      type: navigationType,
    };
  } catch {
    /* never break navigation */
  }
}
