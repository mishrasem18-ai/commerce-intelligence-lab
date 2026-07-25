"use client";

import { useAuth } from "@/lib/store/auth-store";
import { useCustomers } from "@/lib/store/customers-store";
import { resolveAccountState, type AccountState } from "@/lib/auth/buyer-state";
import type { Customer } from "@/lib/data";

/**
 * The signed-in buyer plus their customer profile, with an explicit state.
 *
 * `state` always resolves to ready / unauthenticated / error once the session
 * request has settled — an account screen can never be left on "loading".
 */
export function useBuyerCustomer(): {
  buyer: ReturnType<typeof useAuth>["buyer"];
  customer: Customer | undefined;
  state: AccountState;
  refresh: () => Promise<void>;
} {
  const { buyer, buyerStatus, refreshBuyer } = useAuth();
  const { getCustomer, hydrated: customersHydrated } = useCustomers();
  const customer = buyer ? getCustomer(buyer.customerId) : undefined;
  const state = resolveAccountState({
    status: buyerStatus,
    customersHydrated,
    hasBuyer: Boolean(buyer),
    hasCustomer: Boolean(customer),
  });
  return { buyer, customer, state, refresh: refreshBuyer };
}
