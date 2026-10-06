import { appendFileSync } from "node:fs";
import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";

/** A canonical envelope as exposed by the read-only window.analyticsData inspector. */
export interface CanonicalEvent {
  event_name: string;
  event_id: string;
  page: { path: string; title: string; page_type: string; query_string: string };
  search?: {
    query: string;
    results_count?: number;
    search_source?: string;
    zero_results?: boolean;
    selected_product_id?: string;
  };
}

/** Pre-seed an explicit consent decision so the banner never covers the UI. */
export async function seedConsent(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        "aurora.consent.v1",
        JSON.stringify({
          version: 1,
          state: { necessary: true, analytics: true, advertising: false, personalization: false },
          method: "accept_all",
          decidedAt: "2026-01-01T00:00:00.000Z",
        }),
      );
    } catch {
      /* storage unavailable */
    }
  });
}

/** All canonical events still held by the inspector (most recent 20). */
export async function canonicalEvents(page: Page, name?: string): Promise<CanonicalEvent[]> {
  const events = await page.evaluate(
    () =>
      ((window as unknown as { analyticsData?: { events: unknown[] } }).analyticsData?.events ??
        []) as unknown[],
  );
  return (events as CanonicalEvent[]).filter((e) => !name || e.event_name === name);
}

export const pageViews = (page: Page) => canonicalEvents(page, "page.view");

/** Wait until exactly `count` page.view events exist, then return them. */
export async function expectPageViews(page: Page, count: number): Promise<CanonicalEvent[]> {
  await expect.poll(async () => (await pageViews(page)).length).toBe(count);
  // Hold briefly to prove no late duplicate arrives.
  await page.waitForTimeout(400);
  const views = await pageViews(page);
  expect(views).toHaveLength(count);
  return views;
}

export async function signInAdmin(context: BrowserContext, baseURL: string): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;
  const res = await context.request.post(`${baseURL}/api/admin/login`, { data: { email, password } });
  return res.ok();
}

/** Create (and sign in) a throwaway buyer; the session cookie lands in the context. */
export async function signUpBuyer(
  context: BrowserContext,
  baseURL: string,
): Promise<{ email: string; password: string }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const credentials = { email: `e2e-${stamp}@example.test`, password: "e2e-password-123" };
  const res = await context.request.post(`${baseURL}/api/auth/register`, {
    data: { firstName: "E2E", lastName: "Buyer", mobile: "", ...credentials },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return credentials;
}

/** One object pushed onto window.dataLayer. */
export type Push = Record<string, unknown>;

/**
 * Serve an empty gtm.js, so the adapter's pushes stay on window.dataLayer and
 * no tag runs. Added after the noGoogleHits block, so it wins for gtm.js; every
 * other Google request is still aborted.
 */
export async function stubGtm(context: BrowserContext): Promise<void> {
  await context.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
}

/** Skip the test on a build without NEXT_PUBLIC_GTM_CONTAINER_ID: the adapter pushes nothing. */
export async function skipWithoutGtm(page: Page): Promise<void> {
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

/** The object pushes on window.dataLayer, in order (Consent Mode commands excluded). */
export function dataLayerPushes(page: Page): Promise<Push[]> {
  return page.evaluate(() =>
    ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).filter(
      (e) => Object.prototype.toString.call(e) === "[object Object]",
    ),
  ) as Promise<Push[]>;
}

/** Hosts that load Google tags or receive analytics and ads hits, with their subdomains. */
const GOOGLE_HIT_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "doubleclick.net",
];

const isGoogleHitHost = (url: URL): boolean =>
  GOOGLE_HIT_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));

export const test = base.extend<{ consented: void; noGoogleHits: void }>({
  consented: [
    async ({ context }, use) => {
      await seedConsent(context);
      await use();
    },
    { auto: true },
  ],
  // The local preview is built with the GTM container id from .env.local and
  // specs grant analytics consent, so without this every spec would load the
  // real container and send hits to the real GA4 property. Specs that need
  // GTM behaviour stub gtm.js on top (datalayer.spec.ts): the route added
  // last wins. E2E_REQUEST_LOG=<file> logs every request's outcome as JSON
  // lines.
  noGoogleHits: [
    async ({ context }, use, testInfo) => {
      await context.route(isGoogleHitHost, (route) => route.abort("blockedbyclient"));
      const log = process.env.E2E_REQUEST_LOG;
      if (log) {
        const write = (url: string, result: number | string) =>
          appendFileSync(
            log,
            `${JSON.stringify({ test: testInfo.titlePath.join(" › "), url, result })}\n`,
          );
        context.on("requestfinished", async (request) =>
          write(request.url(), (await request.response())?.status() ?? "no response"),
        );
        context.on("requestfailed", (request) =>
          write(request.url(), request.failure()?.errorText ?? "failed"),
        );
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
