"use client";

import { useSyncExternalStore } from "react";
import { analytics } from "@/lib/analytics";
import type { ConsentRecord } from "@/lib/analytics/consent";

/**
 * Live view of the app-wide consent record. Server snapshot is the default
 * record (no decision), so consent-dependent UI must also gate on
 * `useMounted()` to avoid hydration mismatches with persisted choices.
 */
export function useConsentRecord(): ConsentRecord {
  return useSyncExternalStore(
    (onStoreChange) => analytics.consent.subscribe(onStoreChange),
    () => analytics.consent.get(),
    () => analytics.consent.get(),
  );
}
