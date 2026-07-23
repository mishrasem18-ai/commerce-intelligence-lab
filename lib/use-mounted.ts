"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns `false` during SSR and the first client render, then `true` — without
 * calling setState in an effect. Used to defer theme-dependent UI until the
 * client has hydrated, avoiding hydration mismatches with next-themes.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
