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
export async function signUpBuyer(context: BrowserContext, baseURL: string): Promise<void> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await context.request.post(`${baseURL}/api/auth/register`, {
    data: {
      firstName: "E2E",
      lastName: "Buyer",
      email: `e2e-${stamp}@example.test`,
      mobile: "",
      password: "e2e-password-123",
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export const test = base.extend<{ consented: void }>({
  consented: [
    async ({ context }, use) => {
      await seedConsent(context);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
