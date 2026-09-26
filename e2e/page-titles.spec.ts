import { test, expect, canonicalEvents, expectPageViews, pageViews, signInAdmin, signUpBuyer } from "./fixtures";

/**
 * page.title IS the pageName downstream (GA4 page_title). Every route's
 * canonical page.view must carry the approved title — the same value as the
 * rendered <title> — and exactly one page.view per logical navigation.
 */

const STORE: Array<[path: string, title: string, pageType: string]> = [
  ["/", "Home · Aurora Market", "home"],
  ["/shop", "Shop · Aurora Market", "product_list"],
  ["/shop?category=home", "Shop · Aurora Market", "product_list"],
  ["/cart", "Cart · Aurora Market", "cart"],
  ["/login", "Sign In · Aurora Market", "auth_login"],
  ["/signup", "Sign Up · Aurora Market", "auth_signup"],
  ["/order-confirmation/ORD-0000000", "Order Confirmation · Aurora Market", "order_confirmation"],
  ["/definitely-not-a-page", "Page Not Found · Aurora Market", "not_found"],
  ["/product/prod-99999", "Product Not Found · Aurora Market", "product_detail"],
];

const ACCOUNT: Array<[string, string]> = [
  ["/account", "My Account · Aurora Market"],
  ["/account/orders", "My Orders · Aurora Market"],
  ["/account/orders/ORD-0000000", "Order Detail · Aurora Market"],
  ["/account/profile", "Profile · Aurora Market"],
  ["/account/addresses", "Addresses · Aurora Market"],
  ["/checkout", "Checkout · Aurora Market"],
];

const ADMIN: Array<[string, string, string]> = [
  ["/admin/dashboard", "Dashboard · Aurora Market Admin", "admin_dashboard"],
  ["/admin/products", "Products · Aurora Market Admin", "admin_product_list"],
  ["/admin/products/prod-1000", "Product Detail · Aurora Market Admin", "admin_product_detail"],
  ["/admin/orders", "Orders · Aurora Market Admin", "admin_order_list"],
  ["/admin/orders/ORD-7841", "Order Detail · Aurora Market Admin", "admin_order_detail"],
  ["/admin/customers", "Customers · Aurora Market Admin", "admin_customer_list"],
  ["/admin/customers/C-2201", "Customer Detail · Aurora Market Admin", "admin_customer_detail"],
  ["/admin/analytics", "Analytics · Aurora Market Admin", "admin_analytics"],
  ["/admin/reports", "Reports · Aurora Market Admin", "admin_reports"],
  ["/admin/activity", "Activity · Aurora Market Admin", "admin_activity"],
  ["/admin/ai-assistant", "AI Assistant · Aurora Market Admin", "admin_ai_assistant"],
  ["/admin/settings", "Settings · Aurora Market Admin", "admin_settings"],
];

test.describe("initial load: page.view title equals the approved title", () => {
  for (const [path, title, pageType] of STORE) {
    test(`store ${path}`, async ({ page }) => {
      await page.goto(path);
      const [view] = await expectPageViews(page, 1);
      expect(view.page.title).toBe(title);
      expect(view.page.page_type).toBe(pageType);
      await expect(page).toHaveTitle(title);
    });
  }

  test("PDP uses the product name", async ({ page }) => {
    await page.goto("/shop");
    const href = await page.locator('main a[href^="/product/"]').first().getAttribute("href");
    await page.goto(href!);
    const [view] = await expectPageViews(page, 1);
    const heading = (await page.locator("main h1").first().innerText()).trim();
    expect(view.page.title).toBe(`${heading} · Aurora Market`);
    expect(view.page.page_type).toBe("product_detail");
    await expect(page).toHaveTitle(view.page.title);
  });

  test("an unavailable (draft/archived) product is 'Product Not Found'", async ({ page }) => {
    await page.goto("/product/prod-1000"); // seeded as non-purchasable
    await expect(page.getByRole("heading", { name: "Product not available" })).toBeVisible();
    const [view] = await expectPageViews(page, 1);
    expect(view.page.title).toBe("Product Not Found · Aurora Market");
    await expect(page).toHaveTitle("Product Not Found · Aurora Market");
  });

  test("admin sign-in page", async ({ page }) => {
    await page.goto("/admin/login");
    const [view] = await expectPageViews(page, 1);
    expect(view.page.title).toBe("Sign In · Aurora Market Admin");
    expect(view.page.page_type).toBe("admin_login");
    await expect(page).toHaveTitle("Sign In · Aurora Market Admin");
  });

  test("account routes (signed-in buyer)", async ({ page, context, baseURL }) => {
    await signUpBuyer(context, baseURL!);
    for (const [path, title] of ACCOUNT) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}$`));
      const [view] = await expectPageViews(page, 1);
      expect(view.page.title, path).toBe(title);
      await expect(page).toHaveTitle(title);
    }
  });

  test("admin routes (signed-in admin)", async ({ page, context, baseURL }) => {
    test.skip(!(await signInAdmin(context, baseURL!)), "ADMIN_EMAIL/ADMIN_PASSWORD not set");
    for (const [path, title, pageType] of ADMIN) {
      await page.goto(path);
      const [view] = await expectPageViews(page, 1);
      expect(view.page.title, path).toBe(title);
      expect(view.page.page_type, path).toBe(pageType);
      await expect(page).toHaveTitle(title);
    }
  });
});

test.describe("client navigation: the NEW page's title, one page.view each", () => {
  test("push home→PDP, PDP→PDP, back, forward", async ({ page }) => {
    await page.goto("/");
    await expectPageViews(page, 1);

    const firstHref = await page.locator('main a[href^="/product/"]').first().getAttribute("href");
    await page.locator(`main a[href="${firstHref}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${firstHref}$`));
    let views = await expectPageViews(page, 2);
    const firstTitle = views[1].page.title;
    expect(firstTitle).toMatch(/ · Aurora Market$/);
    expect(firstTitle).not.toBe("Home · Aurora Market");
    await expect(page).toHaveTitle(firstTitle);

    const secondHref = (
      await page.locator('main a[href^="/product/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")))
    ).find((h) => h !== firstHref);
    expect(secondHref, "PDP links to other products").toBeTruthy();
    await page.locator(`main a[href="${secondHref}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${secondHref}$`));
    views = await expectPageViews(page, 3);
    const secondTitle = views[2].page.title;
    expect(secondTitle).not.toBe(firstTitle);
    await expect(page).toHaveTitle(secondTitle);

    await page.goBack();
    views = await expectPageViews(page, 4);
    expect(views[3].page.path).toBe(firstHref);
    expect(views[3].page.title).toBe(firstTitle);

    await page.goForward();
    views = await expectPageViews(page, 5);
    expect(views[4].page.path).toBe(secondHref);
    expect(views[4].page.title).toBe(secondTitle);
  });

  test("PDP titles are correct under a slow network", async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 300,
      downloadThroughput: 200 * 1024,
      uploadThroughput: 100 * 1024,
    });
    await page.goto("/shop");
    await expectPageViews(page, 1);
    const href = await page.locator('main a[href^="/product/"]').first().getAttribute("href");
    await page.locator(`main a[href="${href}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const views = await expectPageViews(page, 2);
    await expect(page).toHaveTitle(views[1].page.title);
    expect(views[1].page.title).not.toBe("Shop · Aurora Market");
    expect(views[1].page.title).not.toBe("");
  });

  test("admin detail→detail and back", async ({ page, context, baseURL }) => {
    test.skip(!(await signInAdmin(context, baseURL!)), "ADMIN_EMAIL/ADMIN_PASSWORD not set");
    await page.goto("/admin/products");
    await expectPageViews(page, 1);
    const hrefs = [
      ...new Set(
        await page
          .locator('a[href^="/admin/products/prod-"]')
          .evaluateAll((as) => as.map((a) => a.getAttribute("href"))),
      ),
    ];
    await page.locator(`a[href="${hrefs[0]}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${hrefs[0]}$`));
    let views = await expectPageViews(page, 2);
    expect(views[1].page.title).toBe("Product Detail · Aurora Market Admin");
    expect(views[1].page.page_type).toBe("admin_product_detail");

    await page.goBack();
    views = await expectPageViews(page, 3);
    expect(views[2].page.title).toBe("Products · Aurora Market Admin");

    await page.locator(`a[href="${hrefs[1]}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${hrefs[1]}$`));
    views = await expectPageViews(page, 4);
    expect(views[3].page.path).toBe(hrefs[1]);
    expect(views[3].page.title).toBe("Product Detail · Aurora Market Admin");

    // Order detail → customer detail (a detail→detail push across entities).
    await page.goto("/admin/orders/ORD-7841");
    await expectPageViews(page, 1);
    await page.locator('a[href^="/admin/customers/"]').first().click();
    await expect(page).toHaveURL(/\/admin\/customers\/[^/]+$/);
    views = await expectPageViews(page, 2);
    expect(views[1].page.title).toBe("Customer Detail · Aurora Market Admin");
    await expect(page).toHaveTitle("Customer Detail · Aurora Market Admin");
  });

  test("same-page query refinements are not page views", async ({ page }) => {
    await page.goto("/shop");
    await expectPageViews(page, 1);
    // Typing in the shop box rewrites ?q= with router.replace per keystroke:
    // page STATE, not a navigation.
    await page.locator("main").getByLabel("Search products").pressSequentially("lamp", { delay: 60 });
    await expect(page).toHaveURL(/q=lamp/);
    await expectPageViews(page, 1);
  });
});

test("page.view precedes the new page's own events (view_item, view_item_list)", async ({ page }) => {
  await page.goto("/shop");
  await expectPageViews(page, 1);
  await page.locator('main a[href^="/product/"]').first().click();
  await expect(page).toHaveURL(/\/product\//);
  await expectPageViews(page, 2);
  const names = (await canonicalEvents(page)).map((e) => `${e.event_name} ${e.page.path}`);
  const pdpView = names.findIndex((n) => n.startsWith("page.view /product/"));
  const viewItem = names.findIndex((n) => n.startsWith("commerce.view_item /product/"));
  expect(viewItem).toBeGreaterThan(pdpView);

  await page.goto("/shop?category=home");
  await expectPageViews(page, 1);
  await expect.poll(async () => (await canonicalEvents(page, "commerce.view_item_list")).length).toBe(1);
  const order = (await canonicalEvents(page)).map((e) => e.event_name);
  expect(order.indexOf("page.view")).toBeLessThan(order.indexOf("commerce.view_item_list"));
});

test("a hand-typed email in the URL never reaches page.path", async ({ page, context, baseURL }) => {
  await signUpBuyer(context, baseURL!);
  await page.goto("/account/orders/jane%40example.com?q=jane%40example.com");
  const [view] = await expectPageViews(page, 1);
  expect(view.page.path).toBe("/account/orders/[redacted]");
  expect(view.page.query_string).toBe("q=[redacted]");
  expect(view.page.title).toBe("Order Detail · Aurora Market");
  const all = JSON.stringify(await pageViews(page));
  expect(all).not.toContain("jane");
});
