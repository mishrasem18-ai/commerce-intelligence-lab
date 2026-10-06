"use client";

import * as React from "react";
import type { Customer, Order } from "@/lib/data";
import {
  customerNeedsUpdate,
  mergeBuyerCustomer,
  mergeBuyerOrders,
} from "@/lib/auth/buyer-state";

/*
 * The signed-in buyer's OWN profile and orders — the only customer and order
 * data the storefront ever holds. Nothing here is server-rendered: the profile
 * arrives with the buyer auth responses (register / login / session) and the
 * orders come from GET /api/account/orders, which the server scopes to the
 * session's user. Other people's records never reach this store.
 *
 * Everything is keyed to one buyer (`ownerId`): a different buyer signing in,
 * or a sign-out, resets the store, and a response that arrives for a previous
 * buyer is dropped.
 */

/** idle: not requested yet · loading · ready · error: the request failed. */
export type BuyerOrdersStatus = "idle" | "loading" | "ready" | "error";

interface BuyerAccountState {
  ownerId: string | null;
  customer: Customer | null;
  orders: Order[];
  ordersStatus: BuyerOrdersStatus;
}

const SIGNED_OUT: BuyerAccountState = {
  ownerId: null,
  customer: null,
  orders: [],
  ordersStatus: "idle",
};

interface BuyerAccountContextValue {
  /** The signed-in buyer's profile, or null when signed out. */
  customer: Customer | null;
  /** The signed-in buyer's orders, as far as they have been loaded. */
  orders: Order[];
  ordersStatus: BuyerOrdersStatus;
  /** Called by the auth store with every server-validated buyer identity. */
  identify: (customerId: string, customer: Customer | null) => void;
  /** Called by the auth store when there is no buyer session (any more). */
  clear: () => void;
  /** Edit the buyer's own profile. Client-side only: the server does not store it yet. */
  updateCustomer: (patch: Partial<Customer>) => void;
  /** (Re)load the buyer's orders from the server. Never throws. */
  loadOrders: (customerId: string) => Promise<void>;
  /** Mirror an order the server just created, for immediate display. */
  addOrder: (order: Order) => void;
}

const BuyerAccountContext = React.createContext<BuyerAccountContextValue | null>(null);

export function useBuyerAccount(): BuyerAccountContextValue {
  const ctx = React.useContext(BuyerAccountContext);
  if (!ctx) throw new Error("useBuyerAccount must be used within <BuyerAccountProvider>");
  return ctx;
}

export function BuyerAccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<BuyerAccountState>(SIGNED_OUT);
  const inFlight = React.useRef<{ ownerId: string; request: Promise<void> } | null>(null);

  const identify = React.useCallback((customerId: string, incoming: Customer | null) => {
    setState((prev) => {
      const base = prev.ownerId === customerId ? prev : { ...SIGNED_OUT, ownerId: customerId };
      const existing = base.customer ?? undefined;
      if (!incoming || !customerNeedsUpdate(existing, incoming)) return base;
      return { ...base, customer: mergeBuyerCustomer(existing, incoming) };
    });
  }, []);

  const clear = React.useCallback(() => {
    setState(SIGNED_OUT);
  }, []);

  const updateCustomer = React.useCallback((patch: Partial<Customer>) => {
    setState((prev) => {
      if (!prev.customer) return prev;
      const next = { ...prev.customer, ...patch };
      if (patch.firstName !== undefined || patch.lastName !== undefined) {
        next.name = `${next.firstName ?? ""} ${next.lastName ?? ""}`.trim() || next.name;
      }
      return { ...prev, customer: next };
    });
  }, []);

  const loadOrders = React.useCallback((customerId: string): Promise<void> => {
    if (inFlight.current?.ownerId === customerId) return inFlight.current.request;

    /** Apply a result only while the same buyer is still signed in. */
    const settle = (apply: (prev: BuyerAccountState) => BuyerAccountState) =>
      setState((prev) => (prev.ownerId === customerId ? apply(prev) : prev));

    const run = async () => {
      try {
        const res = await fetch("/api/account/orders", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`orders request failed: ${res.status}`);
        const data = (await res.json()) as { orders?: Order[] };
        settle((prev) => ({
          ...prev,
          orders: mergeBuyerOrders(prev.orders, data.orders ?? []),
          ordersStatus: "ready",
        }));
      } catch {
        settle((prev) => ({ ...prev, ordersStatus: "error" }));
      } finally {
        if (inFlight.current?.ownerId === customerId) inFlight.current = null;
      }
    };

    settle((prev) => ({ ...prev, ordersStatus: "loading" }));
    const request = run();
    inFlight.current = { ownerId: customerId, request };
    return request;
  }, []);

  const addOrder = React.useCallback((order: Order) => {
    setState((prev) =>
      prev.ownerId && order.customerId === prev.ownerId
        ? { ...prev, orders: mergeBuyerOrders([order, ...prev.orders], []) }
        : prev,
    );
  }, []);

  const value = React.useMemo<BuyerAccountContextValue>(
    () => ({
      customer: state.customer,
      orders: state.orders,
      ordersStatus: state.ordersStatus,
      identify,
      clear,
      updateCustomer,
      loadOrders,
      addOrder,
    }),
    [state, identify, clear, updateCustomer, loadOrders, addOrder],
  );

  return <BuyerAccountContext.Provider value={value}>{children}</BuyerAccountContext.Provider>;
}
