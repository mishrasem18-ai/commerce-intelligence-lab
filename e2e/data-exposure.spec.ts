import { readFileSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, canonicalEvents, signInAdmin, signUpBuyer } from "./fixtures";

/**
 * Customer and order data reaches only the people it belongs to.
 *
 * The root layout used to load every customer and every order and hand them to
 * client stores, so the HTML and RSC payload of every page carried all
 * customers (name, email, mobile) and all orders (shipping address) for any
 * visitor, and GET /api/customers and /api/orders answered without a session.
 *
 * Two throwaway buyers, A and B, are registered in the LOCAL D1 with unique
 * canary values (email, mobile, name, address line) and place one order each.
 * The tests then look for those values, and for the seed customers' emails, in
 * everything a visitor, the other buyer or an admin can receive.
 *
 * Pages are fetched as plain HTTP where possible (no browser, so nothing can
 * reach Google); browser tests run under the fixture that blocks Google hosts.
 */

/** Fabricated emails of the seed customers and orders (migrations/0002_seed.sql). */
const SEED_EMAILS = [
  ...new Set(readFileSync("migrations/0002_seed.sql", "utf8").match(/[\w.+-]+@example\.com/g) ?? []),
];

interface CanaryBuyer {
  /** HTTP client holding this buyer's session cookie. */
  api: APIRequestContext;
  customerId: string;
  email: string;
  password: string;
  lastName: string;
  mobile: string;
  line1: string;
  orderNumber: string;
}

/** Every value that identifies this buyer or their order. */
const canaries = (buyer: CanaryBuyer): string[] => [
  buyer.email,
  buyer.mobile,
  buyer.mobile.replace(/\D/g, ""),
  buyer.lastName,
  buyer.line1,
  buyer.customerId,
  buyer.orderNumber,
];

function expectNoneOf(body: string, needles: string[], where: string): void {
  expect(needles.filter((needle) => body.includes(needle)), where).toEqual([]);
}

let anonymous: APIRequestContext;
let buyerA: CanaryBuyer;
let buyerB: CanaryBuyer;
let productId: string;
let STORE_PAGES: string[];

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!;
  anonymous = await playwright.request.newContext({ baseURL });

  const { products } = (await (await anonymous.get("/api/products")).json()) as {
    products: { id: string; status: string; inventory: number }[];
  };
  productId = products
    .filter((p) => p.status === "Active")
    .sort((x, y) => y.inventory - x.inventory)[0].id;
  STORE_PAGES = ["/", "/shop", `/product/${productId}`, "/login", "/signup", "/cart"];

  const createBuyer = async (tag: string): Promise<CanaryBuyer> => {
    const api = await playwright.request.newContext({ baseURL });
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const digits = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    const buyer = {
      email: `canary-${tag.toLowerCase()}-${stamp}@example.test`,
      password: "e2e-password-123",
      lastName: `Zq${stamp}`,
      mobile: `+91 7${digits}`,
      line1: `${tag} ${stamp} Canary Lane`,
    };
    const registered = await api.post("/api/auth/register", {
      data: {
        firstName: `Canary${tag}`,
        lastName: buyer.lastName,
        email: buyer.email,
        mobile: buyer.mobile,
        password: buyer.password,
      },
    });
    expect(registered.ok(), await registered.text()).toBeTruthy();
    const { buyer: identity } = (await registered.json()) as { buyer: { customerId: string } };

    const ordered = await api.post("/api/orders", {
      data: {
        items: [{ productId, quantity: 1 }],
        shippingAddress: {
          fullName: `Canary${tag} ${buyer.lastName}`,
          mobile: buyer.mobile,
          line1: buyer.line1,
          city: "Pune",
          state: "MH",
          postalCode: "411001",
          country: "India",
          countryCode: "IN",
        },
        contactEmail: buyer.email,
        contactMobile: buyer.mobile,
        paymentMethod: "COD",
      },
    });
    expect(ordered.ok(), await ordered.text()).toBeTruthy();
    const { orderNumber } = (await ordered.json()) as { orderNumber: string };
    return { api, customerId: identity.customerId, orderNumber, ...buyer };
  };

  buyerA = await createBuyer("A");
  buyerB = await createBuyer("B");
});

test.afterAll(async () => {
  await Promise.all([anonymous, buyerA?.api, buyerB?.api].map((api) => api?.dispose()));
});

/** The page as HTML and as the RSC payload the router fetches on navigation. */
async function htmlAndRsc(api: APIRequestContext, path: string): Promise<[string, string][]> {
  const html = await api.get(path);
  expect(html.status(), `${path} html`).toBe(200);
  const rsc = await api.get(path, { headers: { RSC: "1" } });
  expect(rsc.status(), `${path} rsc`).toBe(200);
  expect(rsc.headers()["content-type"], `${path} rsc`).toContain("text/x-component");
  return [
    [`${path} (html)`, await html.text()],
    [`${path} (rsc)`, await rsc.text()],
  ];
}

test.describe("store pages", () => {
  test("the canary values exist in D1 and reach their owner", async () => {
    // Without this, "not found in the page" could simply mean "never stored".
    const session = await (await buyerA.api.get("/api/auth/session")).text();
    expect(session).toContain(buyerA.email);
    expect(session).toContain(buyerA.mobile);
    const orders = await (await buyerA.api.get("/api/account/orders")).text();
    expect(orders).toContain(buyerA.line1);
    expect(SEED_EMAILS.length, "seed emails parsed from the seed migration").toBeGreaterThan(5);
  });

  test("an anonymous visitor receives no customer or order data", async () => {
    for (const path of STORE_PAGES) {
      for (const [where, body] of await htmlAndRsc(anonymous, path)) {
        expectNoneOf(body, [...canaries(buyerA), ...canaries(buyerB), ...SEED_EMAILS], where);
        expect(body.includes("shippingAddress"), `${where}: no order is serialized`).toBe(false);
      }
    }
  });

  test("a signed-in buyer receives nobody else's customer or order data", async () => {
    for (const path of STORE_PAGES) {
      for (const [where, body] of await htmlAndRsc(buyerB.api, path)) {
        expectNoneOf(body, [...canaries(buyerA), ...SEED_EMAILS], `${where} as buyer B`);
      }
    }
  });

  test("the scripts those pages load contain no customer data", async () => {
    const scripts = new Set<string>();
    for (const path of STORE_PAGES) {
      const html = await (await buyerB.api.get(path)).text();
      for (const match of html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)) scripts.add(match[1]);
    }
    expect(scripts.size).toBeGreaterThan(3);
    for (const src of scripts) {
      const body = await (await anonymous.get(src)).text();
      expectNoneOf(body, [...canaries(buyerA), ...canaries(buyerB)], src);
    }
  });
});

test.describe("APIs", () => {
  test("GET /api/orders and /api/customers refuse anonymous, buyer and forged-cookie callers", async ({
    playwright,
    baseURL,
  }) => {
    const forged = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: `cil_admin=${"f".repeat(64)}` },
    });
    const callers: [string, APIRequestContext][] = [
      ["anonymous", anonymous],
      ["buyer", buyerB.api],
      ["forged admin cookie", forged],
    ];
    for (const [caller, api] of callers) {
      for (const path of ["/api/orders", "/api/customers"]) {
        const res = await api.get(path);
        expect(res.status(), `${caller} GET ${path}`).toBe(401);
        expect(res.headers()["cache-control"], `${caller} GET ${path}`).toBe("no-store");
        expectNoneOf(
          await res.text(),
          [...canaries(buyerA), ...canaries(buyerB), ...SEED_EMAILS],
          `${caller} GET ${path}`,
        );
      }
    }
    await forged.dispose();
  });

  test("GET /api/orders and /api/customers answer an admin with the full lists", async ({
    context,
    baseURL,
  }) => {
    test.skip(!(await signInAdmin(context, baseURL!)), "ADMIN_EMAIL/ADMIN_PASSWORD not set");

    const customersRes = await context.request.get("/api/customers");
    expect(customersRes.status()).toBe(200);
    const { customers } = (await customersRes.json()) as { customers: { id: string; email: string }[] };
    const emails = customers.map((c) => c.email);
    expect(emails).toEqual(expect.arrayContaining([buyerA.email, buyerB.email, SEED_EMAILS[0]]));

    const ordersRes = await context.request.get("/api/orders");
    expect(ordersRes.status()).toBe(200);
    const { orders } = (await ordersRes.json()) as {
      orders: { orderNumber: string; shippingAddress?: { line1: string } }[];
    };
    expect(orders.find((o) => o.orderNumber === buyerA.orderNumber)?.shippingAddress?.line1).toBe(buyerA.line1);
    expect(orders.some((o) => o.orderNumber === buyerB.orderNumber)).toBe(true);
  });

  test("GET /api/account/orders returns the caller's own orders only", async () => {
    const anon = await anonymous.get("/api/account/orders");
    expect(anon.status()).toBe(401);

    for (const [own, other] of [
      [buyerA, buyerB],
      [buyerB, buyerA],
    ]) {
      const res = await own.api.get("/api/account/orders");
      expect(res.status()).toBe(200);
      expect(res.headers()["cache-control"]).toBe("no-store");
      const body = await res.text();
      const { orders } = JSON.parse(body) as { orders: { orderNumber: string; customerId: string }[] };
      expect(orders.map((o) => o.orderNumber)).toEqual([own.orderNumber]);
      expect(orders[0].customerId).toBe(own.customerId);
      expectNoneOf(body, canaries(other), "another buyer's data in /api/account/orders");
    }
  });

  test("POST /api/orders still requires a buyer session", async () => {
    const res = await anonymous.post("/api/orders", {
      data: {
        items: [{ productId, quantity: 1 }],
        shippingAddress: { line1: "1 Nowhere", city: "Nowhere" },
      },
    });
    expect(res.status()).toBe(401);
  });
});

/**
 * Text bodies of every same-origin document, RSC and API response the page
 * receives. A redirect has no body, and the body of a prefetch cut off by the
 * next navigation never arrives — those are skipped after a short wait.
 */
function recordResponses(page: Page, baseURL: string): () => Promise<{ url: string; body: string }[]> {
  const pending: Promise<{ url: string; body: string } | null>[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(baseURL) || url.includes("/_next/static/") || url.includes("/products/")) return;
    pending.push(
      Promise.race([
        response
          .text()
          .then((body) => ({ url, body }))
          .catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
      ]),
    );
  });
  return async () => (await Promise.all(pending)).filter((r): r is { url: string; body: string } => r !== null);
}

test.describe("a signed-in buyer", () => {
  test("sees their own profile and orders, and nobody else's", async ({ page, context, baseURL }) => {
    const login = await context.request.post("/api/auth/login", {
      data: { email: buyerB.email, password: buyerB.password },
    });
    expect(login.ok()).toBeTruthy();
    const responses = recordResponses(page, baseURL!);

    await page.goto("/account");
    await expect(page.getByText(buyerB.email)).toBeVisible();
    await expect(page.getByText(buyerB.mobile)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(buyerB.orderNumber) })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(buyerA.orderNumber);

    await page.goto("/account/orders");
    await expect(page.getByRole("link", { name: new RegExp(buyerB.orderNumber) })).toBeVisible();
    await expect(page.locator("main a[href^='/account/orders/']")).toHaveCount(1);

    await page.goto(`/account/orders/${buyerB.orderNumber}`);
    await expect(page.getByRole("heading", { name: buyerB.orderNumber })).toBeVisible();
    await expect(page.getByText(buyerB.line1)).toBeVisible();

    await page.goto(`/order-confirmation/${buyerB.orderNumber}`);
    await expect(page.getByRole("heading", { name: "Order placed successfully" })).toBeVisible();
    await expect(page.getByText(buyerB.line1)).toBeVisible();

    // Buyer A's order number is not B's to see, on either order page.
    await page.goto(`/account/orders/${buyerA.orderNumber}`);
    await expect(page.getByRole("heading", { name: "Order not found" })).toBeVisible();
    await page.goto(`/order-confirmation/${buyerA.orderNumber}`);
    await expect(page.getByRole("heading", { name: "Order not found" })).toBeVisible();

    await page.waitForLoadState("networkidle");
    const received = await responses();
    expect(received.length).toBeGreaterThan(6);
    for (const { url, body } of received) {
      const needles = canaries(buyerA).filter((needle) => !url.includes(needle)); // B typed A's order number into the URL
      expectNoneOf(body, [...needles, ...SEED_EMAILS], `response ${url} as buyer B`);
    }
  });

  test("an anonymous visitor cannot open a buyer's order", async ({ page, baseURL }) => {
    const responses = recordResponses(page, baseURL!);
    await page.goto(`/order-confirmation/${buyerA.orderNumber}`);
    await expect(page.getByRole("heading", { name: "Order not found" })).toBeVisible();
    await page.goto(`/account/orders/${buyerA.orderNumber}`);
    await expect(page).toHaveURL(/\/login\?redirect=/);

    await page.waitForLoadState("networkidle");
    for (const { url, body } of await responses()) {
      const needles = canaries(buyerA).filter((needle) => !url.includes(needle));
      expectNoneOf(body, [...needles, ...SEED_EMAILS], `response ${url} as anonymous`);
    }
  });

  test("checkout creates the order, fires purchase once and shows the confirmation", async ({
    page,
    context,
    baseURL,
  }) => {
    await signUpBuyer(context, baseURL!);
    const line1 = `C ${Date.now().toString(36)} Checkout Lane`;

    await page.goto(`/product/${productId}`);
    // Related-product cards have their own "Add to Cart"; take the one next to "Buy Now".
    await page
      .getByRole("button", { name: "Buy Now" })
      .locator("xpath=..")
      .getByRole("button", { name: "Add to Cart" })
      .click();
    await page.goto("/cart");
    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await page.getByLabel("Mobile number").fill("+91 7000000000");
    await page.getByLabel("Mobile", { exact: true }).fill("+91 7000000000");
    await page.getByLabel("Postal code").fill("411001");
    await page.getByLabel("Address line 1").fill(line1);
    await page.getByLabel("City").fill("Pune");
    await page.getByLabel("State / Region").fill("MH");
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/order-confirmation\/ORD-[0-9A-F]+$/);
    const orderNumber = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: "Order placed successfully" })).toBeVisible();
    await expect(page.getByText(line1)).toBeVisible();

    const purchases = await canonicalEvents(page, "commerce.purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases[0].page.page_type).toBe("checkout");

    // The address saved at checkout is on the account page (in memory, as before).
    await page.getByRole("link", { name: "View My Orders" }).click();
    await expect(page).toHaveURL(/\/account\/orders$/);
    await expect(page.getByRole("link", { name: new RegExp(orderNumber) })).toBeVisible();
    await page.getByRole("link", { name: "Addresses" }).click();
    await expect(page.getByText(line1)).toBeVisible();

    // After a reload the order comes from the server, scoped to this buyer.
    await page.goto(`/order-confirmation/${orderNumber}`);
    await expect(page.getByRole("heading", { name: "Order placed successfully" })).toBeVisible();
    await expect(page.getByText(line1)).toBeVisible();
    expect(await canonicalEvents(page, "commerce.purchase"), "a reload is not a purchase").toHaveLength(0);

    // No copy of the order or the profile is left in localStorage.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expectNoneOf(stored, [line1, orderNumber, "cil.orders.v1", "cil.customers.v1"], "localStorage");
  });
});

test.describe("an admin", () => {
  const FORGED_ADMIN = `cil_admin=${"f".repeat(64)}`;

  test("still gets the lists, the detail pages and the search", async ({ page, context, baseURL }) => {
    test.skip(!(await signInAdmin(context, baseURL!)), "ADMIN_EMAIL/ADMIN_PASSWORD not set");

    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator("main")).toContainText(buyerA.orderNumber); // recent orders

    await page.goto("/admin/customers");
    await expect(page.getByText(SEED_EMAILS[0])).toBeVisible();
    await page.getByLabel("Search customers").fill(buyerA.email);
    await expect(page.getByText(buyerA.email)).toBeVisible();
    await expect(page.getByText(SEED_EMAILS[0])).toBeHidden();

    await page.goto("/admin/orders");
    await page.getByLabel("Search orders").fill(buyerA.orderNumber);
    await expect(page.getByText(buyerA.orderNumber)).toBeVisible();

    await page.goto(`/admin/orders/${buyerA.orderNumber}`);
    await expect(page.getByText(buyerA.line1)).toBeVisible();
    await page.getByRole("link", { name: "View customer profile" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/customers/${buyerA.customerId}$`));
    await expect(page.getByText(buyerA.email).first()).toBeVisible();
    await expect(page.getByText(buyerA.orderNumber)).toBeVisible(); // that customer's orders

    await page.getByRole("combobox", { name: "Search" }).first().fill(buyerA.lastName);
    await expect(page.locator("#global-search-results")).toContainText(buyerA.lastName);
  });

  test("pages give a forged admin cookie nothing", async ({ playwright, baseURL }) => {
    const forged = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: FORGED_ADMIN },
    });
    const paths = [
      "/admin/dashboard",
      "/admin/customers",
      `/admin/customers/${buyerA.customerId}`,
      "/admin/orders",
      `/admin/orders/${buyerA.orderNumber}`,
      "/admin/ai-assistant",
    ];
    for (const path of paths) {
      for (const rsc of [false, true]) {
        const headers: Record<string, string> = rsc ? { RSC: "1" } : {};
        const res = await forged.get(path, { headers });
        const where = `${path} ${rsc ? "(rsc)" : "(html)"} with a forged cookie`;
        const needles = canaries(buyerA).filter((needle) => !path.includes(needle));
        expectNoneOf(await res.text(), [...needles, ...canaries(buyerB), ...SEED_EMAILS], where);
        if (!rsc) expect(res.url(), where).toContain("/admin/login");
      }
    }
    await forged.dispose();
  });

  test("in-app navigation after the session ended returns no record", async ({ page, context, baseURL }) => {
    test.skip(!(await signInAdmin(context, baseURL!)), "ADMIN_EMAIL/ADMIN_PASSWORD not set");
    await page.goto(`/admin/orders/${buyerA.orderNumber}`);
    await expect(page.getByText(buyerA.line1)).toBeVisible();

    // End the session on the server; leave a cookie so the middleware still lets
    // the request through. The layout is already mounted and is not rendered
    // again for an in-app navigation — only the page's own check can refuse.
    await context.request.post("/api/admin/logout");
    await context.addCookies([{ name: "cil_admin", value: "f".repeat(64), url: baseURL! }]);

    const responses = recordResponses(page, baseURL!);
    await page.getByRole("link", { name: "View customer profile" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    // The sign-in form stays: the stale "signed in" state in the browser must
    // not send the admin back to the dashboard, which would redirect here again.
    await expect(page.getByLabel("Email")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/admin\/login$/);

    const received = await responses();
    expect(received.length).toBeGreaterThan(0);
    for (const { url, body } of received) {
      expectNoneOf(
        body,
        [buyerA.email, buyerA.mobile, buyerA.line1, buyerA.lastName, ...SEED_EMAILS],
        `response ${url} after the admin session ended`,
      );
    }
  });
});
