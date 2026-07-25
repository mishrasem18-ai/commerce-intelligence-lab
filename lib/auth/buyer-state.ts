import type { Customer } from "@/lib/data";

/*
 * Pure (framework-free) rules for the buyer auth/account state machine.
 *
 * They live outside the React providers so the guarantee that matters most —
 * "an account screen ALWAYS resolves to authenticated / unauthenticated / error,
 * never an endless Loading…" — is unit-testable without a DOM.
 */

/** Resolution status of the server-validated buyer session (`/api/auth/session`). */
export type BuyerAuthStatus =
  | "loading" // the session request is still in flight
  | "authenticated" // D1 confirmed a live session
  | "unauthenticated" // no/expired/forged session — server said "no buyer"
  | "error"; // the session endpoint could not be reached or failed

/** What an account screen should render. */
export type AccountState = "loading" | "ready" | "unauthenticated" | "error";

/**
 * Decide what an account screen renders.
 *
 * `loading` is only ever returned while something is genuinely still in flight;
 * once the session request has settled, every input combination maps to a
 * terminal state. A signed-in buyer whose profile is missing from the customer
 * store is an `error` (recoverable via refresh), NOT a permanent spinner — that
 * combination is exactly what used to hang the page after registration.
 */
export function resolveAccountState(input: {
  status: BuyerAuthStatus;
  customersHydrated: boolean;
  hasBuyer: boolean;
  hasCustomer: boolean;
}): AccountState {
  if (input.status === "error") return "error";
  if (input.status === "loading" || !input.customersHydrated) return "loading";
  if (input.status === "unauthenticated" || !input.hasBuyer) return "unauthenticated";
  return input.hasCustomer ? "ready" : "error";
}

/**
 * Merge the server's authoritative customer profile into whatever the client
 * already holds. Server fields win for identity/metrics (D1 is the authority);
 * client-only fields the server does not model (addresses) are preserved so a
 * session revalidation can never wipe them.
 */
export function mergeBuyerCustomer(
  existing: Customer | undefined,
  incoming: Customer,
): Customer {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    addresses: existing.addresses ?? incoming.addresses,
  };
}

/** True when merging would actually change the stored record (avoids no-op renders). */
export function customerNeedsUpdate(
  existing: Customer | undefined,
  incoming: Customer,
): boolean {
  if (!existing) return true;
  const merged = mergeBuyerCustomer(existing, incoming);
  return JSON.stringify(merged) !== JSON.stringify(existing);
}
