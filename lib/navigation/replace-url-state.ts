import { recordNavigationMarker } from "@/lib/analytics/navigation";

/**
 * Rewrite the current page's URL without a server round trip.
 *
 * Next.js integrates the native `window.history.replaceState` into the App
 * Router: `usePathname` and `useSearchParams` update, but no RSC payload is
 * requested and nothing is rendered on the server. That is the right tool
 * for same-page state that changes as fast as the user types (the shop
 * search box): a `router.replace` per keystroke costs a server render and a
 * network round trip each, and on a slow network the replies overlap and
 * commit out of step with the input — the live bug this replaced.
 *
 * Next does not call `onRouterTransitionStart` for native history calls, so
 * the "replace" marker the canonical page-view tracker uses to recognise a
 * same-page refinement is recorded here, before the URL changes
 * (lib/analytics/navigation.ts). Not for use across pathnames: a change of
 * page must go through the router so the new page is rendered.
 */
export function replaceUrlState(href: string): void {
  if (typeof window === "undefined") return;
  recordNavigationMarker(href, "replace");
  window.history.replaceState(null, "", href);
}
