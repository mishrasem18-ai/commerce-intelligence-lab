/**
 * Canonical site-search tracking — exactly ONE `search.submit` per deliberate
 * search.
 *
 * Deliberate searches and their `search_source`:
 *  - "header"     — Enter / mobile "Search" key / "See all results" in the
 *                   header box (fires before navigating to /shop?q=);
 *  - "suggestion" — a header suggestion (a product) is chosen: a distinct
 *                   signal, never an additional plain submit;
 *  - "shop"       — Enter / mobile "Search" key in the shop page's box. The
 *                   grid filters live while typing, but keystrokes are page
 *                   state, not searches. Enter (not blur) is the commit:
 *                   blur also fires when a half-typed term is abandoned by
 *                   clicking elsewhere — exactly the partial-term noise the
 *                   old per-keystroke debounce produced;
 *  - "url"        — the shop was LOADED as a document with ?q= (deep link,
 *                   shared link, refresh). Only the document's entry URL
 *                   qualifies, once per document: header searches reach
 *                   /shop?q= by client-side push, never as a document load,
 *                   so they cannot double-fire; back/forward to a ?q= page
 *                   is history, not a new search.
 *
 * Dedupe: an identical consecutive submission (same source, term and result
 * count — e.g. pressing Enter twice) is ignored.
 *
 * The term is normalised (Unicode NFKC, trimmed, whitespace collapsed,
 * lower-cased, max 100 chars); PII redaction happens in the PII guard
 * (`search.query` → "[redacted]" for email/phone-like terms) before any
 * adapter sees the envelope.
 */

import type { SearchContext, SearchSource } from "@/lib/analytics/schema";

export const MAX_SEARCH_TERM_LENGTH = 100;

export function normalizeSearchTerm(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, MAX_SEARCH_TERM_LENGTH);
}

export function buildSearchContext(
  rawTerm: string,
  resultsCount: number,
  source: SearchSource,
): SearchContext | null {
  const query = normalizeSearchTerm(rawTerm);
  if (!query) return null;
  const results_count = Math.max(0, Math.floor(resultsCount));
  return { query, results_count, search_source: source, zero_results: results_count === 0 };
}

export interface SearchTracker {
  /** A deliberate submission from a UI surface. Returns what was tracked. */
  submit(rawTerm: string, resultsCount: number, source: Exclude<SearchSource, "url">): SearchContext | null;
  /**
   * The shop rendered `currentUrl` (pathname + search) with this ?q= term.
   * Tracks a "url" search only if that URL is the document's entry URL and
   * no url search was tracked for this document yet.
   */
  landed(currentUrl: string, rawTerm: string, resultsCount: number): SearchContext | null;
}

export function createSearchTracker(deps: {
  track: (search: SearchContext) => void;
  /** pathname + search of the document as it was loaded; null if unknown. */
  entryUrl: () => string | null;
}): SearchTracker {
  let lastKey: string | null = null;
  let urlSearchHandled = false;

  const emit = (search: SearchContext) => {
    const key = `${search.search_source}|${search.query}|${search.results_count}`;
    if (key === lastKey) return null;
    lastKey = key;
    deps.track(search);
    return search;
  };

  return {
    submit(rawTerm, resultsCount, source) {
      const search = buildSearchContext(rawTerm, resultsCount, source);
      return search ? emit(search) : null;
    },
    landed(currentUrl, rawTerm, resultsCount) {
      if (urlSearchHandled) return null;
      const entry = deps.entryUrl();
      if (entry === null || !sameUrl(entry, currentUrl)) return null;
      urlSearchHandled = true;
      const search = buildSearchContext(rawTerm, resultsCount, "url");
      return search ? emit(search) : null;
    },
  };
}

/** Compare pathname + query of two URLs, ignoring origin and parameter encoding. */
function sameUrl(a: string, b: string): boolean {
  try {
    const x = new URL(a, "http://x.local");
    const y = new URL(b, "http://x.local");
    x.searchParams.sort();
    y.searchParams.sort();
    return x.pathname === y.pathname && x.searchParams.toString() === y.searchParams.toString();
  } catch {
    return false;
  }
}

/** The loaded document's URL (pathname + search), from Navigation Timing. */
export function documentEntryUrl(): string | null {
  if (typeof window === "undefined" || typeof performance === "undefined") return null;
  try {
    const [entry] = performance.getEntriesByType("navigation");
    if (!entry?.name) return null;
    const url = new URL(entry.name);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
