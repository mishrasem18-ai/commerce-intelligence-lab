"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";
import {
  decidePageView,
  markerMatchesUrl,
  readNavigationMarker,
  type TrackedLocation,
} from "@/lib/analytics/navigation";
import { resolvePageContext } from "@/lib/analytics/page-context";
import {
  getPageTitlesVersion,
  subscribePageTitles,
} from "@/lib/routes/page-title-registry";

/**
 * Canonical `page.view` for the App Router — mounted once in the ROOT layout
 * so store, admin and 404 pages are all covered.
 *
 * Exactly ONE canonical page.view per committed LOGICAL navigation, enforced
 * deterministically by `decidePageView` (lib/analytics/navigation.ts):
 *  - identical URLs never re-track (Strict Mode double effects, hydration,
 *    remounts, repeated clicks on the current URL);
 *  - same-pathname `router.replace` query refinements (shop search
 *    keystrokes, filter/sort/pagination) are page STATE, not navigations —
 *    they are represented by search.submit / view_item_list instead;
 *  - pushes, back/forward traversals, pathname changes and initial loads are
 *    always tracked.
 *
 * `page.title` is the NEW page's approved title, resolved from the shared
 * route table — never `document.title`, which streamed metadata can leave
 * empty or stale when this effect runs. The store PDP's title depends on its
 * data, so the PDP registers it (lib/routes/page-title-registry.ts) and this
 * tracker waits for that registration: the registry version is a dependency,
 * so the effect re-runs when it arrives. Event-driven, no timers.
 *
 * Must be rendered inside <Suspense> (useSearchParams requirement for
 * statically rendered routes).
 */

let lastTracked: TrackedLocation | null = null;

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const titlesVersion = React.useSyncExternalStore(
    subscribePageTitles,
    getPageTitlesVersion,
    () => 0,
  );

  React.useEffect(() => {
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    const marker = readNavigationMarker();
    const navigationType =
      marker && markerMatchesUrl(marker.url, url) ? marker.type : "unknown";
    const decision = decidePageView({
      last: lastTracked,
      nextPathname: pathname,
      nextUrl: url,
      navigationType,
    });
    if (!decision.track) return;
    const page = resolvePageContext(pathname, queryString);
    // Data-dependent title not registered yet: wait (re-runs on registration).
    if (page.title === null) return;
    lastTracked = { pathname, url };
    analytics.track("page.view", { page: { ...page, title: page.title } });
  }, [pathname, queryString, titlesVersion]);

  return null;
}
