/**
 * Page-title registrations for data-dependent titles (the store PDP).
 *
 * The PageViewTracker must report the NEW page's final title, but the DOM is
 * not a reliable source: with streamed metadata, `document.title` can still
 * be empty or the previous page's title when the tracker's effect runs
 * (reproduced whenever generateMetadata resolves after the page commits).
 *
 * So titles never come from the DOM. Fixed-title routes resolve synchronously
 * from the route table (lib/routes/page-titles.ts); the PDP registers the
 * title it resolved — with the same `productPageTitle()` its metadata uses —
 * for its pathname, and the tracker waits for that registration. Event-
 * driven: subscribers are notified on every registration; no timers.
 *
 * Framework-free module state so the tracker and pages share one instance.
 */

type Listener = () => void;

const titles = new Map<string, string>();
const listeners = new Set<Listener>();
let version = 0;

export function registerPageTitle(pathname: string, title: string): void {
  if (titles.get(pathname) === title) return;
  titles.set(pathname, title);
  version += 1;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* a listener failure must never break the page */
    }
  }
}

export function getRegisteredTitle(pathname: string): string | null {
  return titles.get(pathname) ?? null;
}

export function subscribePageTitles(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Monotonic snapshot for useSyncExternalStore. */
export function getPageTitlesVersion(): number {
  return version;
}

/** Test seam. */
export function resetPageTitlesForTests(): void {
  titles.clear();
  listeners.clear();
  version = 0;
}
