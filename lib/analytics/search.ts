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
 *                   qualifies, once per document, and not when:
 *                     · the document came from back/forward (history, not a
 *                       new search — Navigation Timing type "back_forward");
 *                     · it is an in-app navigation that the router turned
 *                       into a full page load (after a deploy, a network or
 *                       RSC error): the header and the shop box record their
 *                       target first (`expectNavigation`, per-tab
 *                       sessionStorage, ignored after 30 s), and a document
 *                       landing on that target is the same search arriving.
 *
 * Dedupe: a submission identical to the previous one — same source, term,
 * result count, page URL and input revision (the UI bumps it on every edit)
 * — is ignored: Enter pressed twice. Retyping the same term, or repeating a
 * search from another page, counts again.
 *
 * The term is normalised (Unicode NFKC, trimmed, whitespace collapsed,
 * lower-cased, max 100 chars). A term containing contact details is replaced
 * by "[redacted]" BEFORE truncation (a cut could otherwise leave a partial
 * email behind); the PII guard re-checks `search.query` in every envelope.
 */

import type { SearchContext, SearchSource } from "@/lib/analytics/schema";
import { containsContactDetails, PII_REDACTED } from "@/lib/analytics/pii";

export const MAX_SEARCH_TERM_LENGTH = 100;
/** An in-app navigation marker older than this no longer explains a load. */
export const PENDING_NAVIGATION_TTL_MS = 30_000;
export const PENDING_NAVIGATION_KEY = "aurora.search.pendingNavigation";

function normalizeFull(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeSearchTerm(raw: string): string {
  return normalizeFull(raw).slice(0, MAX_SEARCH_TERM_LENGTH);
}

export function buildSearchContext(
  rawTerm: string,
  resultsCount: number,
  source: SearchSource,
): SearchContext | null {
  const full = normalizeFull(rawTerm);
  if (!full) return null;
  const query = containsContactDetails(full) ? PII_REDACTED : full.slice(0, MAX_SEARCH_TERM_LENGTH);
  const results_count = Math.max(0, Math.floor(resultsCount));
  return { query, results_count, search_source: source, zero_results: results_count === 0 };
}

export interface DocumentEntry {
  /** pathname + search of the loaded document. */
  url: string;
  /** Navigation Timing type: "navigate" | "reload" | "back_forward" | "prerender". */
  type: string;
}

/** Minimal storage surface (sessionStorage in the browser). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SearchTracker {
  /**
   * A deliberate submission from a UI surface. `revision` identifies the
   * input's current edit state (bumped on every change). Returns what was
   * tracked, or null (empty term or an identical repeat).
   */
  submit(
    rawTerm: string,
    resultsCount: number,
    source: Exclude<SearchSource, "url">,
    revision?: number,
  ): SearchContext | null;
  /** Record an in-app navigation target before router.push/replace. */
  expectNavigation(url: string): void;
  /**
   * The shop rendered `currentUrl` (pathname + search) with this ?q= term,
   * with its final result count. Tracks a "url" search per the rules above.
   */
  landed(currentUrl: string, rawTerm: string, resultsCount: number): SearchContext | null;
}

export function createSearchTracker(deps: {
  track: (search: SearchContext) => void;
  /** The loaded document's URL and navigation type; null if unknown. */
  entry: () => DocumentEntry | null;
  /** pathname + search currently shown (dedupe scope). */
  currentUrl: () => string;
  storage?: () => KeyValueStore | null;
  now?: () => number;
}): SearchTracker {
  const now = deps.now ?? (() => Date.now());
  const storage = () => {
    try {
      return deps.storage?.() ?? null;
    } catch {
      return null;
    }
  };
  let lastKey: string | null = null;
  let urlSearchHandled = false;

  const readPending = (): { url: string; at: number } | null => {
    try {
      const raw = storage()?.getItem(PENDING_NAVIGATION_KEY);
      const parsed = raw ? (JSON.parse(raw) as { url?: unknown; at?: unknown }) : null;
      if (!parsed || typeof parsed.url !== "string" || typeof parsed.at !== "number") return null;
      return now() - parsed.at <= PENDING_NAVIGATION_TTL_MS ? { url: parsed.url, at: parsed.at } : null;
    } catch {
      return null;
    }
  };
  const clearPending = () => {
    try {
      storage()?.removeItem(PENDING_NAVIGATION_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  return {
    submit(rawTerm, resultsCount, source, revision = 0) {
      const search = buildSearchContext(rawTerm, resultsCount, source);
      if (!search) return null;
      const key = [source, search.query, search.results_count, deps.currentUrl(), revision].join("|");
      if (key === lastKey) return null;
      lastKey = key;
      deps.track(search);
      return search;
    },
    expectNavigation(url) {
      try {
        storage()?.setItem(PENDING_NAVIGATION_KEY, JSON.stringify({ url, at: now() }));
      } catch {
        /* storage unavailable: worst case a fallback load is counted as "url" */
      }
    },
    landed(currentUrl, rawTerm, resultsCount) {
      const pending = readPending();
      const arrivedInApp = pending !== null && sameUrl(pending.url, currentUrl);
      if (arrivedInApp) clearPending();
      if (urlSearchHandled) return null;
      const entry = deps.entry();
      if (entry === null || !sameUrl(entry.url, currentUrl)) return null;
      urlSearchHandled = true;
      if (entry.type === "back_forward" || arrivedInApp) return null;
      const search = buildSearchContext(rawTerm, resultsCount, "url");
      if (!search) return null;
      lastKey = ["url", search.query, search.results_count, currentUrl, 0].join("|");
      deps.track(search);
      return search;
    },
  };
}

/** Compare pathname + query of two URLs, ignoring origin, encoding and parameter order. */
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

/** The loaded document's URL and navigation type, from Navigation Timing. */
export function documentEntry(): DocumentEntry | null {
  if (typeof window === "undefined" || typeof performance === "undefined") return null;
  try {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (!entry?.name) return null;
    const url = new URL(entry.name);
    return { url: `${url.pathname}${url.search}`, type: entry.type };
  } catch {
    return null;
  }
}
