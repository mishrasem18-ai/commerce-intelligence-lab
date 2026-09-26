/**
 * Canonical page context — title and page type resolved from the shared
 * route table, never from the DOM.
 *
 * `document.title` is racy under streamed metadata (it can still hold the
 * previous page's title, or be empty, when effects run), so both the
 * PageViewTracker and the per-event default context resolve the title here:
 *   1. a title the page registered for this pathname (the PDP), else
 *   2. the route's fixed approved title (lib/routes/page-titles.ts).
 * `title: null` means the route's title depends on page data that has not
 * registered yet — the tracker waits for it.
 */

import type { PageContext } from "@/lib/analytics/schema";
import { resolvePageMeta } from "@/lib/routes/page-titles";
import { getRegisteredTitle } from "@/lib/routes/page-title-registry";

export type ResolvedPageContext = Omit<PageContext, "title"> & { title: string | null };

export function resolvePageContext(pathname: string, queryString: string): ResolvedPageContext {
  const meta = resolvePageMeta(pathname);
  return {
    path: pathname,
    title: getRegisteredTitle(pathname) ?? meta.title,
    page_type: meta.page_type,
    query_string: queryString,
  };
}
