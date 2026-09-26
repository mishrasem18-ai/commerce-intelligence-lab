/**
 * Deterministic logical-navigation identity for canonical page.view events.
 *
 * Invariant: ONE committed logical navigation = ONE canonical page.view.
 *
 * Two deterministic rules (no timers, no debounce):
 *  1. URL identity — a URL identical to the last tracked one is never a new
 *     navigation (absorbs Strict Mode double effects, hydration re-renders,
 *     remounts and repeated clicks on the current URL).
 *  2. Navigation type — a `router.replace` that keeps the same pathname is a
 *     same-page STATE REFINEMENT (shop search keystrokes, filter/sort/page
 *     query updates), not a navigation. Those interactions have their own
 *     canonical events (search.submit, commerce.view_item_list). Pushes,
 *     back/forward traversals, full loads and any pathname change are real
 *     navigations and are always tracked (subject to rule 1).
 *
 * The router transition type comes from Next's `instrumentation-client.ts`
 * hook `onRouterTransitionStart`, which stamps a marker on window before the
 * navigation commits. If no marker matches the committed URL (e.g. the very
 * first load, or an unexpected router path), we conservatively treat the
 * change as a real navigation — worst case is the pre-hardening behaviour.
 */

export type RouterNavigationType = "push" | "replace" | "traverse";

export interface NavigationMarker {
  /** Full href (or path) the router is transitioning to. */
  url: string;
  type: RouterNavigationType;
}

/** Window slot written by instrumentation-client.ts. Vendor-neutral. */
export const NAVIGATION_MARKER_KEY = "__auroraRouterNavigation";

export interface TrackedLocation {
  pathname: string;
  /** pathname + ("?" + query) — the canonical URL identity. */
  url: string;
}

export interface PageViewDecision {
  track: boolean;
  reason:
    | "initial-load"
    | "navigation"
    | "duplicate-url"
    | "same-page-state-refinement";
}

/** Compare a marker's target (href or path) against a committed pathname+search URL. */
export function markerMatchesUrl(markerUrl: string, committedUrl: string): boolean {
  try {
    const parsed = new URL(markerUrl, "http://marker.local");
    return `${parsed.pathname}${parsed.search}` === committedUrl;
  } catch {
    return false;
  }
}

export function decidePageView(options: {
  last: TrackedLocation | null;
  nextPathname: string;
  nextUrl: string;
  navigationType: RouterNavigationType | "initial" | "unknown";
}): PageViewDecision {
  const { last, nextPathname, nextUrl, navigationType } = options;
  if (last === null) return { track: true, reason: "initial-load" };
  if (nextUrl === last.url) return { track: false, reason: "duplicate-url" };
  if (navigationType === "replace" && last.pathname === nextPathname) {
    return { track: false, reason: "same-page-state-refinement" };
  }
  return { track: true, reason: "navigation" };
}

/**
 * The location rule 1 compares against after a decision: the URL now ON
 * SCREEN. A replace-refinement is not tracked, but it does change what is on
 * screen — so a later push back to the pre-refinement URL (e.g. /shop →
 * category dropdown → "All Products" link to /shop) is a new navigation, not
 * a duplicate of a page view that is no longer showing.
 */
export function locationAfter(
  decision: PageViewDecision,
  last: TrackedLocation | null,
  next: TrackedLocation,
): TrackedLocation | null {
  return decision.track || decision.reason === "same-page-state-refinement" ? next : last;
}

/** Read (without consuming) the router marker stamped by instrumentation-client. */
export function readNavigationMarker(
  win: object | null = typeof window === "undefined" ? null : window,
): NavigationMarker | null {
  if (!win) return null;
  const candidate = (win as Record<string, unknown>)[NAVIGATION_MARKER_KEY];
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as NavigationMarker).url === "string" &&
    ((candidate as NavigationMarker).type === "push" ||
      (candidate as NavigationMarker).type === "replace" ||
      (candidate as NavigationMarker).type === "traverse")
  ) {
    return candidate as NavigationMarker;
  }
  return null;
}
