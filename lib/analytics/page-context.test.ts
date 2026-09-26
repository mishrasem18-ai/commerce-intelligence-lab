/**
 * Page-context resolution: titles come from the route table or a page's
 * registration — never the DOM — and data-dependent titles wait.
 * Run: npm test
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resolvePageContext } from "./page-context.ts";
import {
  getPageTitlesVersion,
  registerPageTitle,
  resetPageTitlesForTests,
  subscribePageTitles,
} from "../routes/page-title-registry.ts";

beforeEach(() => resetPageTitlesForTests());

test("fixed-title routes resolve synchronously from the route table", () => {
  assert.deepEqual(resolvePageContext("/admin/customers/C-2201", ""), {
    path: "/admin/customers/C-2201",
    title: "Customer Detail · Aurora Market Admin",
    page_type: "admin_customer_detail",
    query_string: "",
  });
  assert.equal(resolvePageContext("/shop", "category=home").title, "Shop · Aurora Market");
  assert.equal(resolvePageContext("/nope", "").title, "Page Not Found · Aurora Market");
});

test("the PDP title is pending until the page registers it", () => {
  assert.equal(resolvePageContext("/product/prod-1000", "").title, null);
  registerPageTitle("/product/prod-1000", "Halo Desk Lamp · Aurora Market");
  assert.equal(resolvePageContext("/product/prod-1000", "").title, "Halo Desk Lamp · Aurora Market");
  // Registrations are per pathname: another product is still pending.
  assert.equal(resolvePageContext("/product/prod-1001", "").title, null);
});

test("registrations notify subscribers (event-driven wait, no timers)", () => {
  let calls = 0;
  const unsubscribe = subscribePageTitles(() => calls++);
  const before = getPageTitlesVersion();
  registerPageTitle("/product/prod-1", "A · Aurora Market");
  registerPageTitle("/product/prod-1", "A · Aurora Market"); // identical: no-op
  registerPageTitle("/product/prod-2", "B · Aurora Market");
  assert.equal(calls, 2);
  assert.equal(getPageTitlesVersion(), before + 2);
  unsubscribe();
  registerPageTitle("/product/prod-3", "C · Aurora Market");
  assert.equal(calls, 2);
});
