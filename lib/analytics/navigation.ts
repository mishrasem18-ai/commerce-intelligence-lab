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
 * hook `onRouterTransitionStart`, which records a marker before the
 * navigation commits, and from the shop's native `history.replaceState`
 * refinements, which record their own (Next does not call the hook for
 * those). Markers live in a BOUNDED LIST, not a single slot: on a slow
 * network several `router.replace` calls are in flight at once, and a single
 * slot would be overwritten before the earlier commit was checked — that
 * mismatch is what turned every fast keystroke into a page.view on live.
 * The committed URL is looked up in the list. If nothing matches (the very
 * first load, or an unexpected router path), we conservatively treat the
 * change as a real navigation — worst case is the pre-hardening behaviour.
 */

export type RouterNavigationType = "push" | "replace" | "traverse";

export interface NavigationMarker {
  /** Full href (or path) the router is transitioning to. */
  url: string;
  type: RouterNavigationType;
}

/**
 * Window slot holding the recent router transitions (newest last).
 * Vendor-neutral; written by instrumentation-client.ts (router transitions)
 * and by same-page `history.replaceState` refinements, read by the
 * PageViewTracker.
 */
export const NAVIGATION_MARKER_KEY = "__auroraRouterNavigations";

/**
 * How many recent transitions are kept. Far more than can be in flight at
 * once (a keystroke burst on a slow network is a dozen), small enough that
 * the slot never grows: the oldest entries are dropped.
 */
export const MAX_NAVIGATION_MARKERS = 32;

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

function isNavigationMarker(candidate: unknown): candidate is NavigationMarker {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as NavigationMarker).url === "string" &&
    ((candidate as NavigationMarker).type === "push" ||
      (candidate as NavigationMarker).type === "replace" ||
      (candidate as NavigationMarker).type === "traverse")
  );
}

/** The marker list on `win`, or null if the slot is missing or not a list. */
function markerList(win: object | null): unknown[] | null {
  if (!win) return null;
  const list = (win as Record<string, unknown>)[NAVIGATION_MARKER_KEY];
  return Array.isArray(list) ? list : null;
}

/**
 * Record a transition that is about to commit. Called before every router
 * navigation (instrumentation-client.ts) and before every native
 * `history.replaceState` refinement. Never throws.
 */
export function recordNavigationMarker(
  url: string,
  type: RouterNavigationType,
  win: object | null = typeof window === "undefined" ? null : window,
): void {
  if (!win) return;
  try {
    const slot = win as Record<string, unknown>;
    const list = markerList(win) ?? [];
    list.push({ url, type } satisfies NavigationMarker);
    if (list.length > MAX_NAVIGATION_MARKERS) list.splice(0, list.length - MAX_NAVIGATION_MARKERS);
    slot[NAVIGATION_MARKER_KEY] = list;
  } catch {
    /* never break navigation */
  }
}

/**
 * The transition type recorded for a committed URL (pathname + search), or
 * null when none was recorded. The newest matching marker wins. Tampered or
 * malformed entries are ignored.
 */
export function findNavigationMarker(
  committedUrl: string,
  win: object | null = typeof window === "undefined" ? null : window,
): RouterNavigationType | null {
  const list = markerList(win);
  if (!list) return null;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const candidate = list[i];
    if (isNavigationMarker(candidate) && markerMatchesUrl(candidate.url, committedUrl)) {
      return candidate.type;
    }
  }
  return null;
}
