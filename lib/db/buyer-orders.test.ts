/**
 * A buyer reads only their own orders.
 * Run: npm run test:buyer
 *
 * Drives the real query in lib/db/orders.ts and the real GET handler of
 * /api/account/orders against the fake D1, with two buyers who each placed an
 * order. Every value below is a test canary.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "../../test/fake-d1.mjs";
import { __setTestCookies } from "../../test/next-headers-stub.mjs";
import { __setTestDb } from "./client.ts";
import { createUser } from "./users.ts";
import { getOrdersByUserId } from "./orders.ts";
import {
  ADMIN_COOKIE,
  BUYER_COOKIE,
  createAdminSession,
  createBuyerSession,
} from "../auth/session.ts";
import { GET as getAccountOrdersRoute } from "../../app/api/account/orders/route.ts";

const A = { email: "canary-a@example.test", mobile: "+91 70000 00011", line1: "11 Canary Lane", order: "ORD-CANARYA" };
const B = { email: "canary-b@example.test", mobile: "+91 70000 00022", line1: "22 Canary Lane", order: "ORD-CANARYB" };

let db: ReturnType<typeof createFakeD1>;
let aId: string;
let bId: string;

async function addBuyerWithOrder(buyer: typeof A): Promise<string> {
  const { customerId } = await createUser({
    firstName: "Canary",
    lastName: "Buyer",
    email: buyer.email,
    mobile: buyer.mobile,
    passwordHash: "x",
  });
  db._addOrder({
    orderNumber: buyer.order,
    userId: customerId,
    email: buyer.email,
    shipLine1: buyer.line1,
    shipMobile: buyer.mobile,
  });
  return customerId;
}

beforeEach(async () => {
  db = createFakeD1();
  __setTestDb(db as never);
  __setTestCookies({});
  db._admins.set("admin-1", { id: "admin-1", email: "admin@example.test", name: "Admin" });
  aId = await addBuyerWithOrder(A);
  bId = await addBuyerWithOrder(B);
});

test("getOrdersByUserId returns that buyer's orders and line items only", async () => {
  const orders = await getOrdersByUserId(aId);
  assert.deepEqual(orders.map((o) => o.orderNumber), [A.order]);
  assert.equal(orders[0].customerId, aId);
  assert.equal(orders[0].shippingAddress?.line1, A.line1);
  assert.equal(orders[0].lineItems?.length, 1, "only this order's line item");

  assert.deepEqual(await getOrdersByUserId("C-UNKNOWN"), []);
});

test("GET /api/account/orders answers 401 without a buyer session", async () => {
  const callers: [string, Record<string, string>][] = [
    ["anonymous", {}],
    ["forged buyer cookie", { [BUYER_COOKIE]: "f".repeat(64) }],
    ["admin session only", { [ADMIN_COOKIE]: (await createAdminSession("admin-1")).token }],
  ];
  for (const [caller, cookies] of callers) {
    __setTestCookies(cookies);
    const res = await getAccountOrdersRoute();
    const body = await res.text();
    assert.equal(res.status, 401, caller);
    assert.equal(res.headers.get("cache-control"), "no-store");
    for (const canary of [A.email, A.line1, B.email, B.line1]) {
      assert.ok(!body.includes(canary), `${caller}: leaked ${canary}`);
    }
  }
});

test("GET /api/account/orders returns the session buyer's orders and nobody else's", async () => {
  for (const [own, other, userId] of [
    [A, B, aId],
    [B, A, bId],
  ] as const) {
    __setTestCookies({ [BUYER_COOKIE]: (await createBuyerSession(userId)).token });
    const res = await getAccountOrdersRoute();
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(
      (JSON.parse(body) as { orders: { orderNumber: string }[] }).orders.map((o) => o.orderNumber),
      [own.order],
    );
    for (const canary of [other.email, other.mobile, other.line1, other.order]) {
      assert.ok(!body.includes(canary), `leaked the other buyer's ${canary}`);
    }
  }
});

test("an expired buyer session reads no orders", async () => {
  __setTestCookies({ [BUYER_COOKIE]: (await createBuyerSession(aId)).token });
  db._expireAllSessions();
  assert.equal((await getAccountOrdersRoute()).status, 401);
});
