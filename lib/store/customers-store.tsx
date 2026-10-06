"use client";

import * as React from "react";
import { type Customer } from "@/lib/data";

/*
 * ADMIN ONLY. Every customer's record, seeded from D1 by the (protected) admin
 * layout after its server-side session check. Never mount this provider on a
 * route a buyer or an anonymous visitor can reach: whatever it is seeded with
 * is sent to the browser. The storefront uses the buyer account store, which
 * holds only the signed-in buyer's own profile.
 */

interface CustomersContextValue {
  customers: Customer[];
  getCustomer: (id: string) => Customer | undefined;
}

const CustomersContext = React.createContext<CustomersContextValue | null>(null);

export function useCustomers(): CustomersContextValue {
  const ctx = React.useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within <CustomersProvider>");
  return ctx;
}

export function CustomersProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Customer[];
}) {
  const getCustomer = React.useCallback(
    (id: string) => initial.find((c) => c.id === id),
    [initial],
  );

  const value = React.useMemo<CustomersContextValue>(
    () => ({ customers: initial, getCustomer }),
    [initial, getCustomer],
  );

  return (
    <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
  );
}
