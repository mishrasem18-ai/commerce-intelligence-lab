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
import { gtmDataModel } from "../test/gtm-data-model.mjs";

/**
 * No stale keys in window.dataLayer. GTM merges every push into one data
 * model that lasts for the whole page, so each push sets the keys its event
 * doesn't carry to `undefined` ("clear this key") instead of omitting them.
 *
 * Needs a build with NEXT_PUBLIC_GTM_CONTAINER_ID (see .env.local); without
 * one the adapter pushes nothing and these tests skip. gtm.js is stubbed, so
 * the pushes stay inspectable and no hit leaves the test.
 */

const SEARCH_KEYS = ["search_term", "search_results_count", "search_source", "search_zero_results"];

test.beforeEach(async ({ context }) => {
  await stubGtm(context);
});

/** Asserts the push sets `key` to undefined: present, not merely omitted. */
function expectCleared(push: Push | undefined, key: string): void {
  expect(push, key).toBeDefined();
  expect(Object.keys(push!), `${push!.event} clears ${key}`).toContain(key);
  expect(push![key], `${push!.event} clears ${key}`).toBeUndefined();
}

test("login → logout: the next page_view clears customer_id", async ({ page, context, baseURL }) => {
  const { email, password } = await signUpBuyer(context, baseURL!);
  await context.clearCookies(); // sign in through the form instead
  await page.goto("/login");
  await skipWithoutGtm(page);
  const form = page.locator("main form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/account$/);

  // The redirect to /account is an in-app navigation (e2e/auth-navigation.spec.ts),
  // so this document's data model carries the login and every page since.
  const signedInId = () =>
    page.evaluate(
      () =>
        (window as unknown as { analyticsData?: { user: { customer_id?: string } } })
          .analyticsData?.user.customer_id ?? null,
    );
  await expect.poll(signedInId).toMatch(/^C-/);
  const customerId = await signedInId();
  await page.locator("main").getByRole("link", { name: "My Orders" }).click();
  await expect(page).toHaveURL(/\/account\/orders$/);
  await expectPageViews(page, 3);

  await page.locator("main").getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  let pushes: Push[] = [];
  await expect
    .poll(async () => {
      pushes = await dataLayerPushes(page);
      return pushes.filter((p) => p.event === "page_view").map((p) => p.page_path);
    })
    .toEqual(["/login", "/account", "/account/orders", "/"]);

  const login = pushes.find((p) => p.event === "page_view" && p.page_path === "/login");
  expectCleared(login, "customer_id");
  expect(pushes.find((p) => p.event === "login")?.customer_id).toBe(customerId);
  const orders = pushes.find((p) => p.event === "page_view" && p.page_path === "/account/orders");
  expect(orders?.customer_id).toBe(customerId);
  const logoutIndex = pushes.findIndex((p) => p.event === "user.logout");
  expect(pushes[logoutIndex].customer_id).toBe(customerId);
  expect(gtmDataModel(pushes.slice(0, logoutIndex + 1)).customer_id).toBe(customerId);

  const next = pushes.slice(logoutIndex + 1).find((p) => p.event === "page_view");
  expect(next?.page_path).toBe("/");
  expectCleared(next, "customer_id");
  expect(gtmDataModel(pushes).customer_id).toBeUndefined();
});

test("search → navigate: the next page_view clears the search keys", async ({ page }) => {
  await page.goto("/cart");
  await skipWithoutGtm(page);
  await expectPageViews(page, 1);
  const header = page.locator("header").getByLabel("Search products");
  await header.pressSequentially("desk", { delay: 30 });
  await header.press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=desk/);
  await page.locator('main a[href^="/product/"]').first().click();
  await expect(page).toHaveURL(/\/product\//);
  await expectPageViews(page, 3);

  const pushes = await dataLayerPushes(page);
  const searchIndex = pushes.findIndex((p) => p.event === "search");
  expect(pushes[searchIndex]).toMatchObject({ search_term: "desk", search_source: "header" });
  expect(gtmDataModel(pushes.slice(0, searchIndex + 1)).search_term).toBe("desk");

  // The header search fires before navigating: /shop is the next page_view.
  const views = pushes.filter((p) => p.event === "page_view");
  expect(views.map((p) => p.page_path)).toEqual(["/cart", "/shop", expect.stringMatching(/^\/product\//)]);
  expect(pushes.indexOf(views[1])).toBeGreaterThan(searchIndex);
  for (const view of views.slice(1)) {
    for (const key of SEARCH_KEYS) expectCleared(view, key);
  }
  const model = gtmDataModel(pushes);
  for (const key of SEARCH_KEYS) expect(model[key], key).toBeUndefined();
});

test("hard load with no referrer: page_view clears page_referrer", async ({ page, context }) => {
  // Stands in for any earlier value in GTM's data model.
  await context.addInitScript(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [
      { page_referrer: "https://stale.example/" },
    ];
  });
  await page.goto("/");
  await skipWithoutGtm(page);
  await expectPageViews(page, 1);
  expect(await page.evaluate(() => document.referrer)).toBe("");

  const pushes = await dataLayerPushes(page);
  const views = pushes.filter((p) => p.event === "page_view");
  expect(views).toHaveLength(1);
  expectCleared(views[0], "page_referrer");
  expect(gtmDataModel(pushes).page_referrer).toBeUndefined();
});
