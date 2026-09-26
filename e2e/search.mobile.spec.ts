import { test, expect, canonicalEvents } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Mobile keyboards submit a search with their "Search"/"Go" key, which the
 * browser delivers as an implicit form submission. Both search boxes are
 * <form role="search"> with <input type="search" enterkeyhint="search">.
 */

const searches = (page: Page) => canonicalEvents(page, "search.submit");

test("shop box: mobile search key submits once; typing emits nothing", async ({ page }) => {
  await page.goto("/shop");
  const box = page.locator("main").getByLabel("Search products");
  await expect(box).toHaveAttribute("type", "search");
  await expect(box).toHaveAttribute("enterkeyhint", "search");
  await expect(box.locator("xpath=ancestor::form[1]")).toHaveAttribute("role", "search");

  await box.tap();
  await box.pressSequentially("desk", { delay: 100 });
  await page.waitForTimeout(700);
  expect(await searches(page)).toHaveLength(0);

  await box.press("Enter"); // the virtual keyboard's "Search" key
  await expect.poll(async () => (await searches(page)).length).toBe(1);
  await page.waitForTimeout(500);
  const [search] = await searches(page);
  expect(search.search).toMatchObject({ query: "desk", search_source: "shop" });
  await expect(box).not.toBeFocused(); // keyboard dismissed to reveal results
});

test("header search in the mobile menu submits once and lands on /shop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).tap();
  const box = page.getByRole("dialog", { name: "Site menu" }).getByLabel("Search products");
  await expect(box).toHaveAttribute("enterkeyhint", "search");
  await box.pressSequentially("lamp", { delay: 80 });
  await box.press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=lamp/);
  await expect.poll(async () => (await searches(page)).length).toBe(1);
  await page.waitForTimeout(500);
  const all = await searches(page);
  expect(all).toHaveLength(1);
  expect(all[0].search?.search_source).toBe("header");
});
