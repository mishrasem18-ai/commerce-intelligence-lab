/**
 * PII guard tests.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isForbiddenKey, looksLikePiiValue, PII_REDACTED, scrubPii } from "./pii.ts";

test("forbidden keys are detected regardless of casing/underscores", () => {
  for (const key of [
    "email",
    "contactEmail",
    "contact_email",
    "password",
    "passwordHash",
    "sessionToken",
    "session_cookie",
    "mobile",
    "phone_number",
    "firstName",
    "last_name",
    "full-name",
    "shippingAddress",
    "postal_code",
    "cardNumber",
    "apiKey",
    "authorization",
  ]) {
    assert.equal(isForbiddenKey(key), true, `${key} should be forbidden`);
  }
});

test("legitimate analytics keys are NOT forbidden", () => {
  for (const key of [
    "name", // product name
    "customer_id",
    "product_id",
    "list_name",
    "event_name",
    "page_type",
    "query_string",
    "authentication_state",
    "payment_method",
    "brand",
    "category",
  ]) {
    assert.equal(isForbiddenKey(key), false, `${key} should be allowed`);
  }
});

test("email-shaped values are redacted even under innocent keys", () => {
  assert.equal(looksLikePiiValue("buyer@example.com"), true);
  assert.equal(looksLikePiiValue("Aurora Wireless Headphones"), false);
  const { value, violations } = scrubPii({
    note: "contact buyer@example.com for details",
  });
  assert.equal(value.note, PII_REDACTED);
  assert.equal(violations.length, 1);
});

test("scrubPii redacts nested and array-borne PII with paths", () => {
  const input = {
    commerce: {
      items: [{ name: "Desk Lamp", email: "x@y.com", price: 49.99 }],
    },
    user: { customer_id: "C-123", password: "hunter2" },
  };
  const { value, violations } = scrubPii(input);
  assert.equal(value.commerce.items[0].email, PII_REDACTED);
  assert.equal(value.user.password, PII_REDACTED);
  // Legitimate fields are untouched.
  assert.equal(value.commerce.items[0].name, "Desk Lamp");
  assert.equal(value.commerce.items[0].price, 49.99);
  assert.equal(value.user.customer_id, "C-123");
  assert.ok(violations.includes("commerce.items.0.email"));
  assert.ok(violations.includes("user.password"));
});

test("scrubPii never mutates its input", () => {
  const input = { email: "a@b.com", nested: { token: "secret" } };
  scrubPii(input);
  assert.equal(input.email, "a@b.com");
  assert.equal(input.nested.token, "secret");
});

test("a clean commerce payload passes through without violations", () => {
  const input = {
    currency: "USD",
    value: 129.99,
    items: [
      {
        product_id: "prod-1001",
        sku: "AUR-WH-1001",
        name: "Aurora Wireless Headphones",
        brand: "Aurora",
        category: "Electronics",
        price: 129.99,
        quantity: 1,
      },
    ],
  };
  const { value, violations } = scrubPii(input);
  assert.deepEqual(value, input);
  assert.deepEqual(violations, []);
});

/* -------------------------------------------------------------------------- */
/*  User-controlled text: URL path, query string, search term                 */
/* -------------------------------------------------------------------------- */

import {
  containsContactDetails,
  redactPath,
  redactQueryString,
  redactSearchTerm,
} from "./pii.ts";

test("path segments with an email or phone are redacted, ids survive", () => {
  assert.equal(redactPath("/account/orders/jane@x.com"), `/account/orders/${PII_REDACTED}`);
  assert.equal(redactPath("/account/orders/jane%40x.com"), `/account/orders/${PII_REDACTED}`);
  assert.equal(redactPath("/account/orders/+44%2020%207946%200958"), `/account/orders/${PII_REDACTED}`);
  assert.equal(redactPath("/account/orders/555-123-4567"), `/account/orders/${PII_REDACTED}`);
  for (const safe of [
    "/account/orders/ORD-1234567",
    "/product/prod-1000",
    "/admin/customers/C-B6D8B3C6BBDF",
    "/order-confirmation/ORD-C4D4D66",
    "/",
  ]) {
    assert.equal(redactPath(safe), safe);
  }
});

test("query parameters are redacted individually by name or value", () => {
  assert.equal(
    redactQueryString("category=home&q=jane%40x.com&sort=price"),
    `category=home&q=${PII_REDACTED}&sort=price`,
  );
  assert.equal(redactQueryString("email=anything&page=2"), `email=${PII_REDACTED}&page=2`);
  assert.equal(redactQueryString("q=call+555-123-4567"), `q=${PII_REDACTED}`);
  assert.equal(redactQueryString("q=wireless+headphones&page=2"), "q=wireless+headphones&page=2");
  assert.equal(redactQueryString(""), "");
});

test("search terms: contact details redacted, product vocabulary kept", () => {
  for (const pii of [
    "jane.doe@example.com",
    "+1 415 555 0100",
    "(415) 555-0100",
    "4155550100",
    "555-0100 call me",
    "555 1234",
  ]) {
    assert.equal(redactSearchTerm(pii), PII_REDACTED, pii);
  }
  for (const ok of [
    "4K Webcam",
    "Sunscreen SPF 50",
    "2024-2025 planner",
    "RTX 3080 1080p",
    "USB-C Hub",
    "12345678",
  ]) {
    assert.equal(redactSearchTerm(ok), ok, ok);
    assert.equal(containsContactDetails(ok), false, ok);
  }
});

test("scrubPii applies the targeted sanitizers to page and search fields", () => {
  const { value, violations } = scrubPii({
    page: {
      path: "/account/orders/jane%40x.com",
      title: "Order Detail · Aurora Market",
      page_type: "account",
      query_string: "q=jane%40x.com&category=home",
    },
    search: { query: "call 415-555-0100", results_count: 0 },
    event_id: "123e4567-e89b-12d3-a456-426614174000",
    timestamp: "2026-07-26T10:00:00.000Z",
  });
  assert.equal(value.page.path, `/account/orders/${PII_REDACTED}`);
  assert.equal(value.page.query_string, `q=${PII_REDACTED}&category=home`);
  assert.equal(value.page.title, "Order Detail · Aurora Market");
  assert.equal(value.search.query, PII_REDACTED);
  // Digit-heavy system fields are NOT phone-checked.
  assert.equal(value.event_id, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(value.timestamp, "2026-07-26T10:00:00.000Z");
  assert.deepEqual(violations.sort(), ["page.path", "page.query_string", "search.query"]);
});
