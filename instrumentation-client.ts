/**
 * Next.js client instrumentation (runs before hydration).
 *
 * Records the router transition type ("push" | "replace" | "traverse") and
 * target URL in a window marker list BEFORE each navigation commits. The
 * canonical PageViewTracker looks the committed URL up to distinguish real
 * navigations from same-page `router.replace` state refinements (shop
 * filter/sort/pagination), so one logical navigation can never produce more
 * than one canonical page.view. A list, not a slot: on a slow network several
 * replace calls overlap, and the earlier commits must still find their marker.
 *
 * Deliberately tiny (Next warns if client instrumentation exceeds ~16ms) and
 * vendor-neutral: no tracking happens here — only a marker for the canonical
 * layer. See lib/analytics/navigation.ts.
 */

import { recordNavigationMarker } from "@/lib/analytics/navigation";

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
): void {
  recordNavigationMarker(url, navigationType);
}
