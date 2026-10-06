/**
 * Buyer account state-machine tests.
 * Run: node --experimental-strip-types --test lib/auth/buyer-state.test.ts
 *
 * These cover the regression that left /account stuck on "Loading…" after
 * registration: a signed-in buyer whose profile was missing from the client
 * customer snapshot produced a state that never resolved. The rules below are
 * the single place that decides what an account screen renders, so they are
 * asserted exhaustively — no input combination may return "loading" once the
 * session request has settled.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAccountState,
  mergeBuyerCustomer,
  mergeBuyerOrders,
  customerNeedsUpdate,
  type BuyerAuthStatus,
} from "./buyer-state.ts";
import type { Customer, Order } from "../data.ts";

const CUSTOMER: Customer = {
  id: "C-ABC123",
  name: "Repro Tester",
  email: "repro@example.test",
  country: "India",
  countryCode: "IN",
  orders: 0,
  spent: 0,
  status: "New",
  lastSeen: "—",
  firstName: "Repro",
  lastName: "Tester",
  mobile: "+91 98765 43210",
};

// 5/7. A just-registered buyer whose profile arrived with the auth response
// renders immediately — this is the "no browser refresh required" guarantee.
test("authenticated buyer with a profile is ready right away", () => {
  assert.equal(
    resolveAccountState({
      status: "authenticated",
      hasBuyer: true,
      hasCustomer: true,
    }),
    "ready",
  );
});

// The exact pre-fix production state: session valid (header shows the name) but
// the customer snapshot predates the signup. It must NOT be "loading".
test("authenticated buyer with a missing profile resolves to error, never loading", () => {
  const state = resolveAccountState({
    status: "authenticated",
    hasBuyer: true,
    hasCustomer: false,
  });
  assert.notEqual(state, "loading", "this combination used to spin forever");
  assert.equal(state, "error");
});

// 11. An invalid/expired/forged session becomes unauthenticated, not loading.
test("unauthenticated session resolves to unauthenticated", () => {
  assert.equal(
    resolveAccountState({
      status: "unauthenticated",
      hasBuyer: false,
      hasCustomer: false,
    }),
    "unauthenticated",
  );
});

// 12. A failing /api/auth/session (network/5xx) surfaces as an error state with
// a retry — it can never leave the screen loading forever.
test("session API failure resolves to error", () => {
  assert.equal(
    resolveAccountState({
      status: "error",
      hasBuyer: false,
      hasCustomer: false,
    }),
    "error",
  );
});

test("loading is only reported while the session request is in flight", () => {
  assert.equal(
    resolveAccountState({
      status: "loading",
      hasBuyer: false,
      hasCustomer: false,
    }),
    "loading",
  );
});

// Exhaustive safety net: once the session has settled, no combination of
// inputs may return "loading".
test("no settled input combination can produce an infinite loading state", () => {
  const statuses: BuyerAuthStatus[] = ["authenticated", "unauthenticated", "error"];
  for (const status of statuses) {
    for (const hasBuyer of [true, false]) {
      for (const hasCustomer of [true, false]) {
        const state = resolveAccountState({
          status,
          hasBuyer,
          hasCustomer,
        });
        assert.notEqual(
          state,
          "loading",
          `settled state ${status}/buyer=${hasBuyer}/customer=${hasCustomer} must be terminal`,
        );
        assert.ok(["ready", "unauthenticated", "error"].includes(state));
      }
    }
  }
});

// 8. The server profile is what the account screen renders.
test("a missing local record is filled in from the server profile", () => {
  const merged = mergeBuyerCustomer(undefined, CUSTOMER);
  assert.deepEqual(merged, CUSTOMER);
  assert.equal(customerNeedsUpdate(undefined, CUSTOMER), true);
});

// Revalidation must never destroy client-held data the server does not model.
test("re-applying the server profile preserves locally added addresses", () => {
  const withAddress: Customer = {
    ...CUSTOMER,
    addresses: [
      {
        id: "addr-1",
        fullName: "Repro Tester",
        mobile: "+91 98765 43210",
        line1: "12 Test Street",
        city: "Pune",
        state: "MH",
        postalCode: "411001",
        country: "India",
        isDefault: true,
      },
    ],
  };
  const merged = mergeBuyerCustomer(withAddress, CUSTOMER);
  assert.equal(merged.addresses?.length, 1);
  assert.equal(customerNeedsUpdate(withAddress, CUSTOMER), false, "no-op re-render guard");
});

// Server fields stay authoritative for identity/metrics.
test("server fields win over a stale local copy", () => {
  const stale: Customer = { ...CUSTOMER, name: "Old Name", orders: 0, spent: 0 };
  const fresh: Customer = { ...CUSTOMER, name: "Repro Tester", orders: 3, spent: 120.5 };
  const merged = mergeBuyerCustomer(stale, fresh);
  assert.equal(merged.name, "Repro Tester");
  assert.equal(merged.orders, 3);
  assert.equal(merged.spent, 120.5);
  assert.equal(customerNeedsUpdate(stale, fresh), true);
});

const order = (id: string, status: Order["status"] = "Processing"): Order => ({
  id,
  orderNumber: id.replace(/^#/, ""),
  customerId: CUSTOMER.id,
  customer: CUSTOMER.name,
  email: CUSTOMER.email,
  country: "India",
  countryCode: "IN",
  amount: 20.79,
  status,
  date: "2026-10-01",
  items: 1,
});

// The order mirrored from checkout must survive a list that was requested
// before the order existed — otherwise the confirmation page would lose it.
test("an order the server list does not contain yet stays in front", () => {
  const merged = mergeBuyerOrders([order("#ORD-NEW")], [order("#ORD-OLD")]);
  assert.deepEqual(merged.map((o) => o.id), ["#ORD-NEW", "#ORD-OLD"]);
});

test("the server's copy of an order replaces the browser's, once", () => {
  const merged = mergeBuyerOrders(
    [order("#ORD-1", "Processing")],
    [order("#ORD-1", "Shipped"), order("#ORD-0")],
  );
  assert.deepEqual(merged.map((o) => `${o.id}:${o.status}`), ["#ORD-1:Shipped", "#ORD-0:Processing"]);
});

test("mirroring the same order twice keeps one copy", () => {
  const merged = mergeBuyerOrders([order("#ORD-1"), order("#ORD-1"), order("#ORD-0")], []);
  assert.deepEqual(merged.map((o) => o.id), ["#ORD-1", "#ORD-0"]);
});
