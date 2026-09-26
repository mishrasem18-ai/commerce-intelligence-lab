"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { registerPageTitle } from "@/lib/routes/page-title-registry";

/**
 * Register this page's data-dependent title (built with the same helper its
 * generateMetadata uses) for the current pathname, so the PageViewTracker can
 * report it without reading the racy DOM. `null` = not resolved yet.
 *
 * A LAYOUT effect in the page, i.e. a child of the root layout: React runs
 * child layout effects before the parent's, so the tracker (a layout effect
 * mounted after the page in the root layout) sees the registration
 * immediately whenever the page commits together with the navigation.
 */
export function useRegisterPageTitle(title: string | null): void {
  const pathname = usePathname();
  React.useLayoutEffect(() => {
    if (title) registerPageTitle(pathname, title);
  }, [pathname, title]);
}
