import type { Page } from "@playwright/test";
import { test, expect, canonicalEvents, expectPageViews, type CanonicalEvent } from "./fixtures";

/**
 * Same-page query refinements on /shop (typing, pasting, paging) are page
 * STATE, not navigations — at any speed and on any network.
 *
 * On live, every `router.replace` round-trips to the server for the RSC
 * payload, so refinements overlap when the user is faster than the network.
 * The local preview is too fast to overlap by itself; `slowShopRsc` adds the
 * latency back by delaying every router (RSC) request for /shop. Before the
 * fix this reproduced live exactly: a page.view per keystroke (the single
 * navigation marker was overwritten before the earlier commit was checked)
 * and garbled text (an older URL's `q` overwrote a newer draft).
 */

const RSC_DELAY_MS = 250;
const TERM = "the analog mind mini"; // 20 keystrokes

const searches = (page: Page) => canonicalEvents(page, "search.submit");
const shopSearch = (page: Page) => page.locator("main").getByLabel("Search products");

async function expectSearches(page: Page, count: number): Promise<CanonicalEvent[]> {
  await expect.poll(async () => (await searches(page)).length).toBe(count);
  await page.waitForTimeout(500);
  const events = await searches(page);
  expect(events).toHaveLength(count);
  return events;
}

/** Simulate a slow network: every RSC request for /shop takes RSC_DELAY_MS longer. */
async function slowShopRsc(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === "/shop",
    async (route) => {
      if (route.request().headers()["rsc"] === "1") {
        await new Promise((resolve) => setTimeout(resolve, RSC_DELAY_MS));
      }
      try {
        await route.continue();
      } catch {
        /* the page may have moved on */
      }
    },
  );
}

/** page_view pushes on window.dataLayer, when the build has a GTM container id. */
async function dataLayerPageViews(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const w = window as unknown as {
      analyticsData?: { destinations: Array<{ name: string; configured: boolean }> };
      dataLayer?: Array<{ event?: unknown }>;
    };
    const configured = w.analyticsData?.destinations.find((d) => d.name === "gtm")?.configured;
    if (!configured) return null;
    return (w.dataLayer ?? []).filter((e) => e && e.event === "page_view").length;
  });
}

test("typing fast on a slow network: text intact, no page.view, Enter fires once", async ({ page }) => {
  await page.goto("/shop");
  await expectPageViews(page, 1);
  await slowShopRsc(page);

  const box = shopSearch(page);
  await box.click();
  await box.pressSequentially(TERM, { delay: 40 });
  // The box must echo exactly what was typed, immediately and after every
  // late commit has landed. Soft, so one failing run reports both symptoms.
  await expect.soft(box).toHaveValue(TERM);
  await expect.soft(page).toHaveURL(/\?q=the\+analog\+mind\+mini$/);
  await page.waitForTimeout(RSC_DELAY_MS * 3);
  await expect.soft(box).toHaveValue(TERM);
  await expect.soft(page).toHaveURL(/\?q=the\+analog\+mind\+mini$/);

  // Keystrokes are page state: one page.view for the document, no searches.
  await expectPageViews(page, 1);
  expect(await searches(page)).toHaveLength(0);
  expect(await dataLayerPageViews(page)).not.toBeGreaterThan(1);

  // The deliberate submit is the one search, with the full term.
  await box.press("Enter");
  const [search] = await expectSearches(page, 1);
  expect(search.search).toMatchObject({ query: TERM, search_source: "shop" });
  await expectPageViews(page, 1);
});

test("pasting into the shop box: text intact, URL updated, no page.view", async ({ page }) => {
  await page.goto("/shop");
  await expectPageViews(page, 1);
  await slowShopRsc(page);

  const box = shopSearch(page);
  await box.click();
  await page.keyboard.insertText("analog mind"); // one input event, like a paste
  await expect(box).toHaveValue("analog mind");
  await expect(page).toHaveURL(/\?q=analog\+mind$/);
  await page.keyboard.insertText(" mini");
  await expect(box).toHaveValue("analog mind mini");
  await page.waitForTimeout(RSC_DELAY_MS * 3);
  await expect(box).toHaveValue("analog mind mini");
  await expectPageViews(page, 1);
  expect(await searches(page)).toHaveLength(0);
});

test("overlapping router.replace refinements (fast paging) never count as navigations", async ({ page }) => {
  await page.goto("/shop");
  await expectPageViews(page, 1);
  await slowShopRsc(page);

  // Two paging clicks before the first commits: the second must not hide the
  // first's transition type from the tracker.
  const pagination = page.getByRole("navigation", { name: "Pagination" });
  await pagination.getByRole("button", { name: "Page 2" }).click();
  await pagination.getByRole("button", { name: "Page 3" }).click();
  await expect(page).toHaveURL(/\?page=3$/);
  await page.waitForTimeout(RSC_DELAY_MS * 3);
  await expectPageViews(page, 1);
  expect(await dataLayerPageViews(page)).not.toBeGreaterThan(1);
});
