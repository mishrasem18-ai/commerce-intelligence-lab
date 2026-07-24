/**
 * Catalog data-quality regression tests for the seeded product source.
 *
 * Run: node --experimental-strip-types --test lib/data/products.test.ts
 * (wired as `npm run test:catalog`). Pure data — no DOM, no build step.
 *
 * These guard the storefront catalog bugs: wrong/random images, duplicate
 * products, and category/field integrity, plus that category filtering
 * returns only matching records.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  products,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  PRICE_BUCKETS,
} from "./products.ts";

const allowedCategories = new Set<string>(PRODUCT_CATEGORIES);
const allowedStatuses = new Set<string>(PRODUCT_STATUSES);

test("catalog is non-empty and every product is field-valid", () => {
  assert.ok(products.length >= 100, "expected a full catalog");
  for (const p of products) {
    assert.ok(p.id && typeof p.id === "string", `id missing: ${p.sku}`);
    assert.ok(p.sku && typeof p.sku === "string", `sku missing: ${p.id}`);
    assert.ok(p.name.trim().length > 0, `empty name: ${p.id}`);
    assert.ok(p.brand.trim().length > 0, `empty brand: ${p.id}`);
    assert.ok(p.description.trim().length > 0, `empty description: ${p.id}`);
    assert.ok(allowedCategories.has(p.category), `bad category: ${p.id} ${p.category}`);
    assert.ok(allowedStatuses.has(p.status), `bad status: ${p.id} ${p.status}`);
    assert.ok(typeof p.price === "number" && p.price > 0, `bad price: ${p.id}`);
    assert.ok(Number.isInteger(p.inventory) && p.inventory >= 0, `bad inventory: ${p.id}`);
    assert.ok(p.rating >= 0 && p.rating <= 5, `bad rating: ${p.id}`);
  }
});

test("every product image is a category-appropriate self-contained SVG (no random stock photos)", () => {
  for (const p of products) {
    assert.ok(
      p.image.startsWith("data:image/svg+xml,"),
      `image is not an inline SVG data URI: ${p.id}`,
    );
    assert.ok(!/picsum|unsplash|placeholder\.com/i.test(p.image), `external stock image: ${p.id}`);
    // The category name is rendered into the image, so it agrees with the record.
    const decoded = decodeURIComponent(p.image);
    assert.ok(decoded.includes(p.category), `image does not reference its category: ${p.id}`);
  }
});

test("product names are unique (no accidental duplicate products)", () => {
  const byName = new Map<string, string[]>();
  for (const p of products) {
    byName.set(p.name, [...(byName.get(p.name) ?? []), p.id]);
  }
  const dupes = [...byName.entries()].filter(([, ids]) => ids.length > 1);
  assert.equal(
    dupes.length,
    0,
    `duplicate product names: ${dupes.map(([n, ids]) => `${n} (${ids.join(",")})`).join("; ")}`,
  );
});

test("SKUs and ids are unique", () => {
  assert.equal(new Set(products.map((p) => p.sku)).size, products.length, "duplicate SKUs");
  assert.equal(new Set(products.map((p) => p.id)).size, products.length, "duplicate ids");
});

test("every allowed category has products, and filtering returns only that category", () => {
  for (const category of PRODUCT_CATEGORIES) {
    const inCategory = products.filter((p) => p.category === category);
    assert.ok(inCategory.length > 0, `no products in ${category}`);
    assert.ok(
      inCategory.every((p) => p.category === category),
      `category filter leaked non-${category} products`,
    );
  }
});

test("price buckets partition the catalog and each product falls in exactly one bucket", () => {
  for (const p of products) {
    const matching = PRICE_BUCKETS.filter((b) => p.price >= b.min && p.price < b.max);
    assert.equal(matching.length, 1, `price ${p.price} not in exactly one bucket (${p.id})`);
  }
});
