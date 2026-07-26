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
