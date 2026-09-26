import { test, expect, canonicalEvents, expectPageViews, type CanonicalEvent } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * search.submit fires exactly ONCE per deliberate search, and never while
 * typing. Sources: header | suggestion | shop | url.
 */

const searches = (page: Page) => canonicalEvents(page, "search.submit");

async function expectSearches(page: Page, count: number): Promise<CanonicalEvent[]> {
  await expect.poll(async () => (await searches(page)).length).toBe(count);
  await page.waitForTimeout(700); // longer than any old debounce: no late extras
  const events = await searches(page);
  expect(events).toHaveLength(count);
  return events;
}

const headerSearch = (page: Page) => page.locator("header").getByLabel("Search products");
const shopSearch = (page: Page) => page.locator("main").getByLabel("Search products");

/** The product count the shop grid shows ("12 products"). */
async function shownCount(page: Page): Promise<number> {
  const text = await page.locator("main").getByText(/^\d[\d,]* products?$/).first().innerText();
  return Number(text.replace(/[^\d]/g, ""));
}

test("header: typing emits nothing; Enter fires once (before /shop), no double-fire on arrival", async ({ page }) => {
  await page.goto("/cart");
  await expectPageViews(page, 1);
  await headerSearch(page).pressSequentially("  Desk ", { delay: 80 });
  await expectSearches(page, 0);

  await headerSearch(page).press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=/);
  const [search] = await expectSearches(page, 1);
  expect(search.search).toEqual({
    query: "desk",
    results_count: await shownCount(page),
    search_source: "header",
    zero_results: false,
  });
  // The page.view for /shop?q= is a navigation; the search itself fired once.
  const views = await expectPageViews(page, 2);
  expect(views[1].page.path).toBe("/shop");
  // Emitted while still on the originating page, before the navigation.
  expect(search.page.path).toBe("/cart");
});

test("header: 'See all results' is the same single header submit", async ({ page }) => {
  await page.goto("/");
  await headerSearch(page).pressSequentially("desk", { delay: 50 });
  await page.getByRole("button", { name: "See all results" }).click();
  await expect(page).toHaveURL(/\/shop\?q=desk/);
  const [search] = await expectSearches(page, 1);
  expect(search.search?.search_source).toBe("header");
  expect(search.search?.results_count).toBe(await shownCount(page));
});

test("suggestion click is a distinct signal, not a plain submit", async ({ page }) => {
  await page.goto("/");
  await headerSearch(page).pressSequentially("Writing Desk", { delay: 50 });
  await expectSearches(page, 0);
  const suggestion = page.locator("header form[role=search] ~ div button").first();
  await suggestion.click();
  await expect(page).toHaveURL(/\/product\//);
  const [search] = await expectSearches(page, 1);
  expect(search.search?.search_source).toBe("suggestion");
  expect(search.search?.query).toBe("writing desk");
  expect(search.search?.results_count).toBeGreaterThan(0);
});

test("shop box: live filtering while typing emits nothing; Enter fires once", async ({ page }) => {
  await page.goto("/shop");
  await shopSearch(page).pressSequentially("desk", { delay: 120 });
  await expect(page).toHaveURL(/q=desk/);
  await expectSearches(page, 0);

  await shopSearch(page).press("Enter");
  const [search] = await expectSearches(page, 1);
  expect(search.search).toEqual({
    query: "desk",
    results_count: await shownCount(page),
    search_source: "shop",
    zero_results: false,
  });

  // Pressing Enter again on the unchanged search is not a new search.
  await shopSearch(page).press("Enter");
  await expectSearches(page, 1);
  // Blur is not a submit.
  await shopSearch(page).fill("desks");
  await page.locator("main h1").click();
  await expectSearches(page, 1);
  // Typing never created a page.view either (replace-refinements).
  await expectPageViews(page, 1);
});

test("deep link /shop?q= fires once with source url; refresh fires once again", async ({ page }) => {
  await page.goto("/shop?q=Desk");
  const [search] = await expectSearches(page, 1);
  expect(search.search?.search_source).toBe("url");
  expect(search.search?.query).toBe("desk");
  expect(search.search?.results_count).toBe(await shownCount(page));

  await page.reload();
  const [again] = await expectSearches(page, 1);
  expect(again.search?.search_source).toBe("url");
});

test("deep link /shop?q= counts locally created (overlay) products", async ({ page, context }) => {
  // Baseline: the D1 catalog alone.
  await page.goto("/shop?q=desk");
  const [base] = await expectSearches(page, 1);
  const d1Count = base.search?.results_count ?? 0;
  expect(d1Count).toBeGreaterThan(0);

  // An admin-created product lives only in the localStorage overlay until
  // write-through; the grid shows it after hydration, so results_count must too.
  const now = new Date().toISOString();
  const overlay = [{
    id: "prod-new-e2e-1", sku: "E2E-DSK-1", name: "Overlay Standing Desk",
    description: "Created in the admin, not yet in D1.", categoryId: "furniture",
    category: "Furniture", brand: "Aurora", price: 499, cost: 250, inventory: 5,
    status: "Active", rating: 4.5, image: "", unitsSold: 0, revenue: 0,
    createdAt: now, updatedAt: now,
  }];
  await context.addInitScript((value) => {
    window.localStorage.setItem("cil.products.v1", value);
  }, JSON.stringify(overlay));

  const fresh = await context.newPage();
  await fresh.goto("/shop?q=desk");
  await expect(fresh.getByText("Overlay Standing Desk").first()).toBeVisible();
  const [search] = await expectSearches(fresh, 1);
  expect(search.search?.search_source).toBe("url");
  expect(search.search?.results_count).toBe(d1Count + 1);
  expect(search.search?.results_count).toBe(await shownCount(fresh));
});

test("leaving a deep-linked search and coming back does not re-fire", async ({ page }) => {
  await page.goto("/shop?q=desk");
  await expectSearches(page, 1);
  await page.locator('main a[href^="/product/"]').first().click();
  await expect(page).toHaveURL(/\/product\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/shop\?q=desk/);
  await expectSearches(page, 1);
});

test("zero-result searches are flagged", async ({ page }) => {
  await page.goto("/");
  await headerSearch(page).pressSequentially("qqqzzzxxx", { delay: 30 });
  await headerSearch(page).press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=qqqzzzxxx/);
  await expect(page.getByText("No products found")).toBeVisible();
  const [search] = await expectSearches(page, 1);
  expect(search.search).toMatchObject({ results_count: 0, zero_results: true });
});

test("an email typed as a search never leaves the canonical layer", async ({ page }) => {
  await page.goto("/");
  await headerSearch(page).pressSequentially("jane.doe@example.com", { delay: 20 });
  await headerSearch(page).press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=/);
  const [search] = await expectSearches(page, 1);
  expect(search.search?.query).toBe("[redacted]");
  const views = await expectPageViews(page, 2);
  expect(views[1].page.query_string).toBe("q=[redacted]");
  const all = JSON.stringify(await canonicalEvents(page));
  expect(all).not.toContain("jane");
});

test("admin global search is not tracked", async ({ page, context, baseURL }) => {
  const { signInAdmin } = await import("./fixtures");
  test.skip(!(await signInAdmin(context, baseURL!)), "ADMIN_EMAIL/ADMIN_PASSWORD not set");
  await page.goto("/admin/dashboard");
  await expectPageViews(page, 1);
  const box = page.getByPlaceholder(/search/i).first();
  await box.click();
  await box.pressSequentially("lamp", { delay: 30 });
  await box.press("Enter");
  await page.waitForTimeout(800);
  expect(await searches(page)).toHaveLength(0);
});
