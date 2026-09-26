import { test, signInAdmin } from "./fixtures";

/**
 * Review screenshots (not assertions). Opt-in:
 *   SCREENSHOTS_DIR=/some/dir npx playwright test e2e/screenshots.spec.ts
 */
const DIR = process.env.SCREENSHOTS_DIR;
test.skip(!DIR, "set SCREENSHOTS_DIR to capture review screenshots");

const PAGES: Array<[name: string, path: string, admin?: boolean]> = [
  ["home", "/"],
  ["shop", "/shop"],
  ["pdp", "/product/prod-1106"],
  ["cart", "/cart"],
  ["credits", "/credits"],
  ["admin-products", "/admin/products", true],
];

for (const theme of ["light", "dark"] as const) {
  for (const [name, path, admin] of PAGES) {
    test(`${name} (${theme})`, async ({ page, context, baseURL }) => {
      await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
      if (admin) test.skip(!(await signInAdmin(context, baseURL!)), "no admin credentials");
      if (name === "cart") {
        // Put two products in the cart so the thumbnails are visible.
        await page.goto("/shop");
        const add = page.getByRole("button", { name: /add to cart/i });
        await add.nth(0).click();
        await add.nth(1).click();
      }
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Let lazy images below the fold load for the full-page capture.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${DIR}/${name}-${theme}.png`, fullPage: name !== "credits" });
    });
  }
}
