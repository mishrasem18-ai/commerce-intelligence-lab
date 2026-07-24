"use client";

import * as React from "react";
import { type Customer } from "@/lib/data";

const STORAGE_KEY = "cil.customers.v1";

export interface NewCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  country?: string;
  countryCode?: string;
}

interface CustomersContextValue {
  customers: Customer[];
  hydrated: boolean;
  getCustomer: (id: string) => Customer | undefined;
  getCustomerByEmail: (email: string) => Customer | undefined;
  addCustomer: (input: NewCustomerInput) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  recordOrder: (id: string, amount: number, date: string) => void;
}

const CustomersContext = React.createContext<CustomersContextValue | null>(null);

export function useCustomers(): CustomersContextValue {
  const ctx = React.useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within <CustomersProvider>");
  return ctx;
}

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `C-${Date.now().toString(36)}-${idCounter}`.toUpperCase();
}

export function CustomersProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Customer[];
}) {
  // Seed customers come from D1 (server-provided `initial`). Buyer sign-ups are
  // kept in a localStorage overlay until write-through (Phase D/E).
  const [customers, setCustomers] = React.useState<Customer[]>(initial);
  const [hydrated, setHydrated] = React.useState(false);
  const d1Ids = React.useMemo(() => new Set(initial.map((c) => c.id)), [initial]);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const overlay = (JSON.parse(raw) as Customer[]).filter((c) => !d1Ids.has(c.id));
        if (overlay.length > 0) setCustomers([...overlay, ...initial]);
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist ONLY locally-created customers (ids not in D1).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const overlay = customers.filter((c) => !d1Ids.has(c.id));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [customers, hydrated, d1Ids]);

  const getCustomer = React.useCallback(
    (id: string) => customers.find((c) => c.id === id),
    [customers],
  );

  const getCustomerByEmail = React.useCallback(
    (email: string) =>
      customers.find((c) => c.email.toLowerCase() === email.trim().toLowerCase()),
    [customers],
  );

  const addCustomer = React.useCallback((input: NewCustomerInput) => {
    const now = new Date().toISOString();
    const created: Customer = {
      id: generateId(),
      name: `${input.firstName} ${input.lastName}`.trim(),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      mobile: input.mobile,
      country: input.country ?? "India",
      countryCode: input.countryCode ?? "IN",
      orders: 0,
      spent: 0,
      status: "New",
      lastSeen: "just now",
      addresses: [],
      joinedAt: now,
    };
    setCustomers((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCustomer = React.useCallback((id: string, patch: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.firstName !== undefined || patch.lastName !== undefined) {
          next.name = `${next.firstName ?? ""} ${next.lastName ?? ""}`.trim() || next.name;
        }
        return next;
      }),
    );
  }, []);

  const recordOrder = React.useCallback(
    (id: string, amount: number, date: string) => {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                orders: c.orders + 1,
                spent: Math.round((c.spent + amount) * 100) / 100,
                lastOrderDate: date,
                lastSeen: "just now",
                status: c.status === "New" ? "Active" : c.status,
              }
            : c,
        ),
      );
    },
    [],
  );

  const value = React.useMemo<CustomersContextValue>(
    () => ({
      customers,
      hydrated,
      getCustomer,
      getCustomerByEmail,
      addCustomer,
      updateCustomer,
      recordOrder,
    }),
    [
      customers,
      hydrated,
      getCustomer,
      getCustomerByEmail,
      addCustomer,
      updateCustomer,
      recordOrder,
    ],
  );

  return (
    <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
  );
}
