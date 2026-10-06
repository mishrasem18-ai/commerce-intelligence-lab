import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, canonicalEvents, signUpBuyer } from "./fixtures";

/**
 * Sign-up and login must stay in the SAME document until GA4 has sent their
 * hits. GA4 batches hits for up to ~5 s (observed on live), and a document
 * load discards the queue: on live, the redirect to /account after sign-up
 * was a document load and no `sign_up` hit ever left the browser.
 *
 * Why it was a document load: while signed out, the footer's /account links
 * were prefetched, the middleware answered the prefetch with a redirect to
 * /login, and the router cached that redirect as the route for /account.
 * After signing in, `router.replace("/account")` hit the stale entry and fell
 * back to a full navigation. Links prefetch when they enter the viewport, so
 * each test scrolls the footer into view first — as a real screen tall enough
 * to show it does — and lets any prefetch finish before submitting.
 *
 * The container is stubbed with a fake that behaves like GA4's batching: 5 s
 * after each app push it issues a `/g/collect` request. The global fixture
 * aborts every Google host, so the request can never reach Google — the
 * aborted ATTEMPT, made while the page is already on /account, is the proof
 * that the hit would have been issued. Needs a build with
 * NEXT_PUBLIC_GTM_CONTAINER_ID; otherwise these tests skip.
 */

const BATCH_DELAY_MS = 5_000;

const STUB_CONTAINER = `(function () {
  var dl = (window.dataLayer = window.dataLayer || []);
  var push = Array.prototype.push;
  dl.push = function () {
    for (var i = 0; i < arguments.length; i += 1) {
      var entry = arguments[i];
      if (entry && typeof entry === "object" && typeof entry.event === "string" && entry.event.indexOf("gtm.") !== 0) {
        (function (ev) {
          setTimeout(function () {
            fetch("https://www.google-analytics.com/g/collect?v=2&en=" + encodeURIComponent(ev.event) +
              "&app_event_id=" + encodeURIComponent(ev.event_id || ""), { method: "POST" }).catch(function () {});
          }, ${BATCH_DELAY_MS});
        })(entry);
      }
    }
    return push.apply(dl, arguments);
  };
})();`;

/** Bring the footer's account links into the viewport and let any prefetch they trigger finish. */
async function exposeFooterLinks(page: Page): Promise<void> {
  await page.locator("footer").getByRole("link", { name: "My Account" }).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  await page.locator("main form").scrollIntoViewIfNeeded();
}

async function stubContainer(context: BrowserContext): Promise<void> {
  await context.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: STUB_CONTAINER }),
  );
}

async function skipWithoutGtm(page: Page): Promise<void> {
  const configured = await page.evaluate(
    () =>
      (
        window as unknown as {
          analyticsData?: { destinations: Array<{ name: string; configured: boolean }> };
        }
      ).analyticsData?.destinations.find((d) => d.name === "gtm")?.configured ?? false,
  );
  test.skip(!configured, "built without NEXT_PUBLIC_GTM_CONTAINER_ID");
}

/** Observe GA4 collect attempts: which events, and whether any request completed. */
function watchCollects(page: Page): { attempted: string[]; completed: string[] } {
  const seen = { attempted: [] as string[], completed: [] as string[] };
  const isCollect = (url: string) => {
    const u = new URL(url);
    return u.hostname.endsWith("google-analytics.com") && u.pathname.endsWith("/collect");
  };
  page.on("request", (req) => {
    if (isCollect(req.url())) seen.attempted.push(new URL(req.url()).searchParams.get("en") ?? "?");
  });
  page.on("requestfinished", (req) => {
    if (isCollect(req.url())) seen.completed.push(req.url());
  });
  return seen;
}

type Push = Record<string, unknown>;

function dataLayer(page: Page): Promise<Push[]> {
  return page.evaluate(() =>
    ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).filter(
      (e) => Object.prototype.toString.call(e) === "[object Object]",
    ),
  ) as Promise<Push[]>;
}

/** The auth push, then the /account page_view, both in this document's dataLayer and with the customer id. */
async function expectAuthPushThenAccountView(page: Page, event: "sign_up" | "login"): Promise<void> {
  const pushes = await dataLayer(page);
  const authIndex = pushes.findIndex((p) => p.event === event);
  expect(authIndex, `${event} was pushed`).toBeGreaterThanOrEqual(0);
  expect(pushes[authIndex].customer_id).toMatch(/^C-/);
  const accountView = pushes.findIndex((p) => p.event === "page_view" && p.page_path === "/account");
  expect(accountView, "the /account page_view follows in the same document").toBeGreaterThan(authIndex);
  expect(pushes[accountView].customer_id).toBe(pushes[authIndex].customer_id);
}

async function expectBatchedHitIssued(page: Page, seen: ReturnType<typeof watchCollects>, event: string) {
  // Still the same document, well past GA4's batching window.
  await expect.poll(() => seen.attempted, { timeout: BATCH_DELAY_MS + 4_000 }).toContain(event);
  await expect(page).toHaveURL(/\/account$/);
  expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
  // Never delivered: every attempt is aborted by the Google-host block.
  expect(seen.completed).toEqual([]);
}

test("sign-up through the form stays in one document and its hit is issued", async ({ page, context }) => {
  await stubContainer(context);
  const seen = watchCollects(page);
  await page.goto("/signup");
  await skipWithoutGtm(page);
  await exposeFooterLinks(page);
  await page.evaluate(() => {
    (window as unknown as { __sameDocument?: boolean }).__sameDocument = true;
  });

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const form = page.locator("main form");
  await form.getByLabel("First name").fill("E2E");
  await form.getByLabel("Last name").fill("Signup");
  await form.getByLabel("Email").fill(`e2e-ui-${stamp}@example.test`);
  await form.getByLabel("Mobile number").fill("9876543210");
  await form.getByLabel("Password", { exact: true }).fill("e2e-password-123");
  await form.getByLabel("Confirm password").fill("e2e-password-123");
  await form.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await expectAuthPushThenAccountView(page, "sign_up");
  const events = (await canonicalEvents(page)).map((e) => `${e.event_name}@${e.page.path}`);
  expect(events).toEqual(expect.arrayContaining(["page.view@/signup", "user.sign_up@/signup", "page.view@/account"]));
  await expectBatchedHitIssued(page, seen, "sign_up");
});

test("login through the form stays in one document and its hit is issued", async ({ page, context, baseURL }) => {
  await stubContainer(context);
  const { email, password } = await signUpBuyer(context, baseURL!);
  await context.clearCookies();
  const seen = watchCollects(page);
  await page.goto("/login");
  await skipWithoutGtm(page);
  await exposeFooterLinks(page);
  await page.evaluate(() => {
    (window as unknown as { __sameDocument?: boolean }).__sameDocument = true;
  });

  const form = page.locator("main form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await expectAuthPushThenAccountView(page, "login");
  const events = (await canonicalEvents(page)).map((e) => `${e.event_name}@${e.page.path}`);
  expect(events).toEqual(expect.arrayContaining(["page.view@/login", "user.login@/login", "page.view@/account"]));
  await expectBatchedHitIssued(page, seen, "login");
});
