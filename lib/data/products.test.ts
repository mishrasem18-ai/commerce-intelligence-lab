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
  categoryPlaceholderImage,
  products,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  PRODUCT_TYPE_NOUNS,
  PRICE_BUCKETS,
} from "./products.ts";
import { productImageKey } from "../catalog/product-images.ts";
import {
  categoryIdFromName,
  categoryName,
  isCategoryId,
} from "../catalog/categories.ts";

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
    // The canonical id and the display label must always describe the same
    // category — the pair is what storefront filtering and the UI each read.
    assert.ok(isCategoryId(p.categoryId), `bad categoryId: ${p.id} ${p.categoryId}`);
    assert.equal(
      categoryName(p.categoryId),
      p.category,
      `categoryId/category mismatch: ${p.id}`,
    );
    assert.ok(allowedStatuses.has(p.status), `bad status: ${p.id} ${p.status}`);
    assert.ok(typeof p.price === "number" && p.price > 0, `bad price: ${p.id}`);
    assert.ok(Number.isInteger(p.inventory) && p.inventory >= 0, `bad inventory: ${p.id}`);
    assert.ok(p.rating >= 0 && p.rating <= 5, `bad rating: ${p.id}`);
  }
});

test("every product image is the key of its own category's product type", () => {
  for (const p of products) {
    const keys = PRODUCT_TYPE_NOUNS[p.category].map(productImageKey);
    assert.ok(keys.includes(p.image), `${p.id}: "${p.image}" is not a ${p.category} product type`);
    assert.match(p.image, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${p.id}: image must be a short key`);
  }
  // Short keys, not data URIs: the catalog payload no longer carries images.
  assert.ok(products.every((p) => p.image.length <= 40));
});

test("runtime-created products get a self-contained category placeholder", () => {
  const image = categoryPlaceholderImage("Gaming", "Custom Pad");
  assert.ok(image.startsWith("data:image/svg+xml,"));
  assert.ok(decodeURIComponent(image).includes("Gaming"));
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
    const inCategory = products.filter((p) => p.categoryId === categoryIdFromName(category));
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
