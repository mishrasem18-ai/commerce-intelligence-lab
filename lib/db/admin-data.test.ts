/**
 * Who may read the full customer and order lists.
 * Run: npm run test:buyer
 *
 * Drives the real guard (lib/auth/guards.ts), the real admin data module and
 * the real GET handlers of /api/orders and /api/customers against the fake D1.
 * The request's cookies come from test/next-headers-stub.mjs. Every value
 * below is a test canary; no row comes from a real database.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "../../test/fake-d1.mjs";
import { __setTestCookies } from "../../test/next-headers-stub.mjs";
import { __setTestDb } from "./client.ts";
import { createUser } from "./users.ts";
import {
  ADMIN_COOKIE,
  BUYER_COOKIE,
  createAdminSession,
  createBuyerSession,
} from "../auth/session.ts";
import { currentAdminSession, currentBuyerSession } from "../auth/guards.ts";
import {
  AdminSessionRequiredError,
  getCustomerForAdmin,
  getCustomersForAdmin,
  getOrderForAdmin,
  getOrdersForAdmin,
} from "./admin-data.ts";
import { GET as getOrdersRoute } from "../../app/api/orders/route.ts";
import { GET as getCustomersRoute } from "../../app/api/customers/route.ts";

const CANARY_EMAIL = "canary-buyer@example.test";
const CANARY_MOBILE = "+91 70000 00001";
const CANARY_LINE1 = "1 Canary Lane";

let db: ReturnType<typeof createFakeD1>;
let buyerId: string;

beforeEach(async () => {
  db = createFakeD1();
  __setTestDb(db as never);
  __setTestCookies({});
  db._admins.set("admin-1", { id: "admin-1", email: "admin@example.test", name: "Admin" });
  const buyer = await createUser({
    firstName: "Canary",
    lastName: "Buyer",
    email: CANARY_EMAIL,
    mobile: CANARY_MOBILE,
    passwordHash: "x",
  });
  buyerId = buyer.customerId;
  db._addOrder({
    orderNumber: "ORD-CANARY1",
    userId: buyerId,
    email: CANARY_EMAIL,
    shipLine1: CANARY_LINE1,
    shipMobile: CANARY_MOBILE,
  });
});

async function asAdmin(): Promise<void> {
  const { token } = await createAdminSession("admin-1");
  __setTestCookies({ [ADMIN_COOKIE]: token });
}

/** The four admin reads, each of which must refuse without an admin session. */
const ADMIN_READS: [string, () => Promise<unknown>][] = [
  ["getOrdersForAdmin", () => getOrdersForAdmin()],
  ["getOrderForAdmin", () => getOrderForAdmin("ORD-CANARY1")],
  ["getCustomersForAdmin", () => getCustomersForAdmin()],
  ["getCustomerForAdmin", () => getCustomerForAdmin(buyerId)],
];

async function assertRefused(caller: string): Promise<void> {
  assert.equal(await currentAdminSession(), null, `${caller}: no admin session`);
  for (const [name, read] of ADMIN_READS) {
    await assert.rejects(read, AdminSessionRequiredError, `${caller}: ${name} must refuse`);
  }
  for (const [path, handler] of [
    ["/api/orders", getOrdersRoute],
    ["/api/customers", getCustomersRoute],
  ] as const) {
    const res = await handler();
    const body = await res.text();
    assert.equal(res.status, 401, `${caller}: GET ${path}`);
    assert.equal(res.headers.get("cache-control"), "no-store");
    for (const canary of [CANARY_EMAIL, CANARY_MOBILE, CANARY_LINE1, buyerId]) {
      assert.ok(!body.includes(canary), `${caller}: GET ${path} leaked ${canary}`);
    }
  }
}

test("an anonymous request gets no customer or order data", async () => {
  await assertRefused("anonymous");
});

test("a forged admin cookie gets no customer or order data", async () => {
  __setTestCookies({ [ADMIN_COOKIE]: "f".repeat(64) });
  await assertRefused("forged cookie");
});

test("a signed-in buyer gets no customer or order data", async () => {
  const { token } = await createBuyerSession(buyerId);
  __setTestCookies({ [BUYER_COOKIE]: token });
  assert.equal((await currentBuyerSession())?.userId, buyerId, "the buyer session itself is valid");
  await assertRefused("buyer");
});

test("a buyer session token in the admin cookie is not an admin session", async () => {
  const { token } = await createBuyerSession(buyerId);
  __setTestCookies({ [ADMIN_COOKIE]: token, [BUYER_COOKIE]: token });
  await assertRefused("buyer token as admin cookie");
});

test("an expired admin session gets no customer or order data", async () => {
  await asAdmin();
  db._expireAllSessions();
  await assertRefused("expired admin session");
});

test("an admin session whose admin user is gone gets no customer or order data", async () => {
  await asAdmin();
  db._admins.clear();
  await assertRefused("deleted admin");
});

test("a valid admin session reads the full lists and single records", async () => {
  await asAdmin();
  assert.equal((await currentAdminSession())?.adminUserId, "admin-1");

  const orders = await getOrdersForAdmin();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].shippingAddress?.line1, CANARY_LINE1);
  assert.equal((await getOrderForAdmin("ORD-CANARY1"))?.customerId, buyerId);

  const customers = await getCustomersForAdmin();
  assert.deepEqual(customers.map((c) => c.email), [CANARY_EMAIL]);
  assert.equal((await getCustomerForAdmin(buyerId))?.mobile, CANARY_MOBILE);
});

test("GET /api/orders and /api/customers answer an admin with the lists, uncached", async () => {
  await asAdmin();

  const ordersRes = await getOrdersRoute();
  assert.equal(ordersRes.status, 200);
  assert.equal(ordersRes.headers.get("cache-control"), "no-store");
  const { orders } = (await ordersRes.json()) as { orders: { orderNumber: string }[] };
  assert.deepEqual(orders.map((o) => o.orderNumber), ["ORD-CANARY1"]);

  const customersRes = await getCustomersRoute();
  assert.equal(customersRes.status, 200);
  assert.equal(customersRes.headers.get("cache-control"), "no-store");
  const { customers } = (await customersRes.json()) as { customers: { id: string }[] };
  assert.deepEqual(customers.map((c) => c.id), [buyerId]);
});
