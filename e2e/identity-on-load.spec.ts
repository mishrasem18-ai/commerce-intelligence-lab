import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import {
  test,
  expect,
  dataLayerPushes,
  expectPageViews,
  signUpBuyer,
  skipWithoutGtm,
  stubGtm,
  type Push,
} from "./fixtures";

/**
 * A signed-in buyer's identity on a hard load.
 *
 * The buyer's customer id used to reach analytics only when the browser's
 * session check (/api/auth/session) came back, which is after the document's
 * first events: the first page_view of every hard-loaded page, and a product
 * page's view_item, had no customer_id. The root layout now validates the
 * session cookie against D1 and hands the page the buyer's own opaque id, so
 * the first event already carries it.
 *
 * The id is the only thing the server adds, and only to its owner's response:
 * the HTTP tests below check that nobody else's response contains it and that
 * no email or name comes with it.
 */

const FORGED_COOKIE = "f".repeat(64);

let productId: string;

test.beforeAll(async ({ playwright }, testInfo) => {
  const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL! });
  const { products } = (await (await api.get("/api/products")).json()) as {
    products: { id: string; status: string; inventory: number }[];
  };
  productId = products
    .filter((p) => p.status === "Active")
    .sort((x, y) => y.inventory - x.inventory)[0].id;
  await api.dispose();
});

test.beforeEach(async ({ context }) => {
  await stubGtm(context);
});

async function sessionCustomerId(api: APIRequestContext): Promise<string> {
  const { buyer } = (await (await api.get("/api/auth/session")).json()) as {
    buyer: { customerId: string } | null;
  };
  expect(buyer?.customerId).toMatch(/^C-/);
  return buyer!.customerId;
}

/**
 * Holds the browser's own session check until `release()`, so whatever the
 * page sends before that cannot have taken the id from it.
 */
async function holdSessionCheck(context: BrowserContext): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await context.route("**/api/auth/session", async (route) => {
    await held;
    await route.fallback();
  });
  return release;
}

const pageViews = (pushes: Push[]): Push[] => pushes.filter((p) => p.event === "page_view");

/** The canonical layer's current customer id (window.analyticsData), or null. */
const currentCustomerId = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { analyticsData?: { user: { customer_id?: string } } }).analyticsData
        ?.user.customer_id ?? null,
  );

test("hard load while signed in: the first page_view and view_item carry customer_id", async ({
  page,
  context,
  baseURL,
}) => {
  await signUpBuyer(context, baseURL!);
  const customerId = await sessionCustomerId(context.request);
  const release = await holdSessionCheck(context);

  await page.goto(`/product/${productId}`);
  await skipWithoutGtm(page);
  await expectPageViews(page, 1);
  await expect
    .poll(async () => (await dataLayerPushes(page)).some((p) => p.event === "view_item"))
    .toBe(true);

  let pushes = await dataLayerPushes(page);
  expect(pageViews(pushes)).toHaveLength(1);
  expect(pageViews(pushes)[0].customer_id).toBe(customerId);
  expect(pushes.find((p) => p.event === "view_item")?.customer_id).toBe(customerId);
  // Every push of the document so far, not only those two.
  for (const push of pushes.filter((p) => "event_id" in p)) {
    expect(push.customer_id, `${push.event}`).toBe(customerId);
  }

  // The session check settling changes nothing: same id, still one page_view.
  const settled = page.waitForResponse((response) => response.url().endsWith("/api/auth/session"));
  release();
  await settled;
  await expectPageViews(page, 1);
  pushes = await dataLayerPushes(page);
  expect(pageViews(pushes)).toHaveLength(1);
  expect(await currentCustomerId(page)).toBe(customerId);
});

test("hard load while signed in, then sign out: the next page_view clears customer_id", async ({
  page,
  context,
  baseURL,
}) => {
  await signUpBuyer(context, baseURL!);
  const customerId = await sessionCustomerId(context.request);

  await page.goto("/account/orders");
  await skipWithoutGtm(page);
  await expectPageViews(page, 1);
  expect(pageViews(await dataLayerPushes(page))[0].customer_id).toBe(customerId);

  await page.locator("main").getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expectPageViews(page, 2);
  const pushes = await dataLayerPushes(page);
  const home = pageViews(pushes).at(-1)!;
  expect(home.page_path).toBe("/");
  expect(Object.keys(home)).toContain("customer_id");
  expect(home.customer_id).toBeUndefined();
  expect(pushes.find((p) => p.event === "user.logout")?.customer_id).toBe(customerId);

  // Signed out on the server too: a new document starts without an id.
  await page.goto("/shop");
  await expectPageViews(page, 1);
  expect(pageViews(await dataLayerPushes(page))[0].customer_id).toBeUndefined();
  expect(await currentCustomerId(page)).toBeNull();
});

test("hard load without a valid session: page_view has no customer_id", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/");
  await skipWithoutGtm(page);
  await expectPageViews(page, 1);
  let view = pageViews(await dataLayerPushes(page))[0];
  expect(Object.keys(view)).toContain("customer_id");
  expect(view.customer_id).toBeUndefined();

  // A cookie that is present but matches no session row is not an identity.
  await context.addCookies([{ name: "cil_buyer", value: FORGED_COOKIE, url: baseURL! }]);
  await page.goto("/shop");
  await expectPageViews(page, 1);
  view = pageViews(await dataLayerPushes(page))[0];
  expect(view.customer_id).toBeUndefined();
  expect(await currentCustomerId(page)).toBeNull();
});

test.describe("the id in the page source", () => {
  interface Buyer {
    api: APIRequestContext;
    customerId: string;
    email: string;
    lastName: string;
  }
  let anonymous: APIRequestContext;
  let forged: APIRequestContext;
  let buyerA: Buyer;
  let buyerB: Buyer;
  let PAGES: string[];

  test.beforeAll(async ({ playwright }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL!;
    anonymous = await playwright.request.newContext({ baseURL });
    forged = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: `cil_buyer=${FORGED_COOKIE}` },
    });
    const createBuyer = async (tag: string): Promise<Buyer> => {
      const api = await playwright.request.newContext({ baseURL });
      const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const buyer = { email: `id-${tag}-${stamp}@example.test`, lastName: `Zq${stamp}` };
      const registered = await api.post("/api/auth/register", {
        data: { firstName: `Id${tag}`, mobile: "", password: "e2e-password-123", ...buyer },
      });
      expect(registered.ok(), await registered.text()).toBeTruthy();
      return { api, customerId: await sessionCustomerId(api), ...buyer };
    };
    buyerA = await createBuyer("a");
    buyerB = await createBuyer("b");
    PAGES = ["/", "/shop", `/product/${productId}`, "/cart", "/login", "/no-such-page"];
  });

  test.afterAll(async () => {
    await Promise.all([anonymous, forged, buyerA?.api, buyerB?.api].map((api) => api?.dispose()));
  });

  /** The page as HTML and as the RSC payload the router fetches. */
  async function htmlAndRsc(
    api: APIRequestContext,
    path: string,
  ): Promise<{ where: string; body: string; cacheControl: string }[]> {
    const html = await api.get(path);
    const rsc = await api.get(path, { headers: { RSC: "1" } });
    return [
      { where: `${path} (html)`, body: await html.text(), cacheControl: html.headers()["cache-control"] ?? "" },
      { where: `${path} (rsc)`, body: await rsc.text(), cacheControl: rsc.headers()["cache-control"] ?? "" },
    ];
  }

  test("a signed-in buyer's own page carries their id, and no email or name", async () => {
    for (const path of PAGES) {
      const [html] = await htmlAndRsc(buyerA.api, path);
      expect(html.body, `${html.where} as its owner`).toContain(buyerA.customerId);
      expect(html.body, `${html.where}: no email`).not.toContain(buyerA.email);
      expect(html.body, `${html.where}: no name`).not.toContain(buyerA.lastName);
      // A response that names a buyer must never be stored by a shared cache.
      expect(html.cacheControl, `${html.where} cache-control`).toContain("private");
      expect(html.cacheControl, `${html.where} cache-control`).toContain("no-store");
    }
  });

  test("anonymous, forged-cookie and other-buyer responses never contain the id", async () => {
    const others: [string, APIRequestContext][] = [
      ["anonymous", anonymous],
      ["forged cookie", forged],
      ["buyer B", buyerB.api],
    ];
    for (const path of PAGES) {
      for (const [who, api] of others) {
        for (const { where, body } of await htmlAndRsc(api, path)) {
          expect(body.includes(buyerA.customerId), `${where} as ${who}: buyer A's id`).toBe(false);
          if (who !== "buyer B") {
            expect(body.includes(buyerB.customerId), `${where} as ${who}: buyer B's id`).toBe(false);
            // No customer id of any buyer: the ids are "C-" + 12 hex digits.
            expect(body.match(/\bC-[0-9A-F]{12}\b/g) ?? [], `${where} as ${who}`).toEqual([]);
          }
        }
      }
    }
  });
});
