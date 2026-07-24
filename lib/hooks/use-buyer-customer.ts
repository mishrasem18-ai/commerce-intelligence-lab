"use client";

import { useAuth } from "@/lib/store/auth-store";
import { useCustomers } from "@/lib/store/customers-store";
import type { Customer } from "@/lib/data";

export function useBuyerCustomer(): {
  buyer: ReturnType<typeof useAuth>["buyer"];
  customer: Customer | undefined;
  hydrated: boolean;
} {
  const { buyer, hydrated: authHydrated } = useAuth();
  const { getCustomer, hydrated: customersHydrated } = useCustomers();
  const customer = buyer ? getCustomer(buyer.customerId) : undefined;
  return { buyer, customer, hydrated: authHydrated && customersHydrated };
}
