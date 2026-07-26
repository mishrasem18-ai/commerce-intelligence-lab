/**
 * Vendor-neutral consent model.
 *
 * Four categories; `necessary` is structurally always `true` (the type says
 * so and every mutation path re-forces it). No Google Consent Mode, no Adobe
 * consent APIs — vendor consent mapping belongs to future adapters.
 *
 * Persistence is client-side localStorage. The store is a small framework-free
 * observable so it can be unit-tested in Node and consumed from React through
 * `useSyncExternalStore` (see `lib/analytics/use-consent.ts`).
 */

export const CONSENT_CATEGORIES = [
  "necessary",
  "analytics",
  "advertising",
  "personalization",
] as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  personalization: boolean;
}

/** How the current consent state was reached. */
export type ConsentDecisionMethod =
  | "default"
  | "accept_all"
  | "reject_all"
  | "custom";

export interface ConsentRecord {
  version: 1;
  state: ConsentState;
  /** How the current state was reached. "default" = no explicit choice yet. */
  method: ConsentDecisionMethod;
  /** ISO timestamp of the explicit decision; null until the user decides. */
  decidedAt: string | null;
}

export const CONSENT_STORAGE_KEY = "aurora.consent.v1";

/** Explicit default: only strictly-necessary is on until the user decides. */
export function defaultConsentRecord(): ConsentRecord {
  return {
    version: 1,
    state: {
      necessary: true,
      analytics: false,
      advertising: false,
      personalization: false,
    },
    method: "default",
    decidedAt: null,
  };
}

export function acceptAllState(): ConsentState {
  return { necessary: true, analytics: true, advertising: true, personalization: true };
}

export function rejectAllState(): ConsentState {
  return { necessary: true, analytics: false, advertising: false, personalization: false };
}

/**
 * Merge user preferences into a full state. `necessary` cannot be disabled —
 * any attempt is silently overridden back to `true`.
 */
export function withPreferences(
  preferences: Partial<Record<ConsentCategory, boolean>>,
): ConsentState {
  return {
    necessary: true,
    analytics: preferences.analytics === true,
    advertising: preferences.advertising === true,
    personalization: preferences.personalization === true,
  };
}

/** Safely parse a persisted record; anything malformed falls back to default. */
export function normalizeConsentRecord(raw: unknown): ConsentRecord {
  if (typeof raw !== "object" || raw === null) return defaultConsentRecord();
  const candidate = raw as Partial<ConsentRecord>;
  if (candidate.version !== 1 || typeof candidate.state !== "object" || !candidate.state) {
    return defaultConsentRecord();
  }
  const state = candidate.state as Partial<Record<ConsentCategory, unknown>>;
  const method: ConsentDecisionMethod =
    candidate.method === "accept_all" ||
    candidate.method === "reject_all" ||
    candidate.method === "custom"
      ? candidate.method
      : "default";
  return {
    version: 1,
    state: withPreferences({
      analytics: state.analytics === true,
      advertising: state.advertising === true,
      personalization: state.personalization === true,
    }),
    method,
    decidedAt: typeof candidate.decidedAt === "string" ? candidate.decidedAt : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

/** Minimal storage seam so tests can inject a fake and SSR can inject none. */
export interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ConsentStore {
  get(): ConsentRecord;
  getState(): ConsentState;
  /** True once the user has made an explicit choice (banner can hide). */
  hasDecision(): boolean;
  acceptAll(): ConsentRecord;
  rejectAll(): ConsentRecord;
  setPreferences(preferences: Partial<Record<ConsentCategory, boolean>>): ConsentRecord;
  subscribe(listener: (record: ConsentRecord) => void): () => void;
}

function defaultStorage(): ConsentStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createConsentStore(
  storage: ConsentStorage | null = defaultStorage(),
  now: () => string = () => new Date().toISOString(),
): ConsentStore {
  let record = defaultConsentRecord();
  try {
    const raw = storage?.getItem(CONSENT_STORAGE_KEY);
    if (raw) record = normalizeConsentRecord(JSON.parse(raw));
  } catch {
    /* malformed storage falls back to default consent */
  }

  const listeners = new Set<(record: ConsentRecord) => void>();

  const commit = (state: ConsentState, method: ConsentDecisionMethod): ConsentRecord => {
    record = { version: 1, state, method, decidedAt: now() };
    try {
      storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* quota/unavailable storage must never break the app */
    }
    for (const listener of [...listeners]) {
      try {
        listener(record);
      } catch {
        /* a faulty listener must not affect others */
      }
    }
    return record;
  };

  return {
    get: () => record,
    getState: () => record.state,
    hasDecision: () => record.decidedAt !== null,
    acceptAll: () => commit(acceptAllState(), "accept_all"),
    rejectAll: () => commit(rejectAllState(), "reject_all"),
    setPreferences: (preferences) => commit(withPreferences(preferences), "custom"),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
