"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { registerPageTitle } from "@/lib/routes/page-title-registry";

/**
 * Register this page's data-dependent title (built with the same helper its
 * generateMetadata uses) for the current pathname, so the PageViewTracker can
 * report it without reading the racy DOM. `null` = not resolved yet.
 *
 * A LAYOUT effect: it runs before every passive effect of the same commit,
 * so the tracker (a passive effect in the root layout) sees the registration
 * immediately whenever the page commits together with the navigation.
 */
export function useRegisterPageTitle(title: string | null): void {
  const pathname = usePathname();
  React.useLayoutEffect(() => {
    if (title) registerPageTitle(pathname, title);
  }, [pathname, title]);
}
