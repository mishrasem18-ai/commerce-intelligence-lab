"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { pageTypeFromPath } from "@/lib/analytics/schema";
import {
  decidePageView,
  markerMatchesUrl,
  readNavigationMarker,
  type TrackedLocation,
} from "@/lib/analytics/navigation";

/**
 * Canonical `page.view` for the App Router.
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
 * Must be rendered inside <Suspense> (useSearchParams requirement for
 * statically rendered routes).
 */

let lastTracked: TrackedLocation | null = null;

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

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
    lastTracked = { pathname, url };
    analytics.track("page.view", {
      page: {
        path: pathname,
        // document.title is set by the App Router before effects run.
        title: document.title,
        page_type: pageTypeFromPath(pathname),
        query_string: queryString,
      },
    });
  }, [pathname, queryString]);

  return null;
}
