"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { pageTypeFromPath } from "@/lib/analytics/schema";

/**
 * Canonical `page.view` for the App Router.
 *
 * One event per COMMITTED navigation: the effect keys on pathname+search, and
 * a module-level "last tracked URL" guard suppresses duplicates from React
 * Strict Mode's double-invoked effects, hydration re-renders and component
 * remounts. Navigating away and back produces a fresh view (the key changes
 * in between), which is the intended behaviour.
 *
 * Must be rendered inside <Suspense> (useSearchParams requirement for
 * statically rendered routes).
 */

let lastTrackedUrl: string | null = null;

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  React.useEffect(() => {
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    if (url === lastTrackedUrl) return;
    lastTrackedUrl = url;
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
