/**
 * Canonical category identity tests.
 *
 * Run: node --experimental-strip-types --test lib/catalog/categories.test.ts
 * (wired as `npm run test:catalog`).
 *
 * These pin the category ids and their ORDER against the D1 migration, because
 * the demo catalog assigns categories positionally — a reordering here would
 * silently re-categorise every generated product.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALL_CATEGORIES,
  CATEGORIES,
  CATEGORY_IDS,
  categoryFields,
  categoryIdFromName,
  categoryName,
  categorySelectionLabel,
  isCategoryId,
  PRIMARY_NAV_CATEGORIES,
  PRIMARY_NAV_CATEGORY_IDS,
  PRODUCT_CATEGORIES,
  resolveCategory,
  SECONDARY_NAV_CATEGORIES,
} from "./categories.ts";

const SEED_SQL = readFileSync(
  fileURLToPath(new URL("../../migrations/0002_seed.sql", import.meta.url)),
  "utf8",
);

test("category ids and order match the D1 categories table exactly", () => {
  const seeded = [...SEED_SQL.matchAll(/INSERT INTO categories \(id, name\) VALUES \('([^']+)', '([^']+)'\);/g)]
    .map(([, id, name]) => ({ id, name }));

  assert.ok(seeded.length > 0, "no categories found in the seed migration");
  assert.deepEqual(
    seeded,
    CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
    "lib/catalog/categories.ts has drifted from migrations/0002_seed.sql",
  );
});

test("display-name and id lists stay aligned", () => {
  assert.deepEqual([...PRODUCT_CATEGORIES], CATEGORIES.map((c) => c.name));
  assert.deepEqual([...CATEGORY_IDS], CATEGORIES.map((c) => c.id));
  for (const c of CATEGORIES) {
    assert.equal(categoryName(c.id), c.name);
    assert.equal(categoryIdFromName(c.name), c.id);
    assert.ok(isCategoryId(c.id));
  }
  assert.equal(isCategoryId("nope"), false);
  assert.equal(isCategoryId(ALL_CATEGORIES), false, "'all' is not a category id");
});

test("resolveCategory accepts slugs, display names and any casing", () => {
  assert.equal(resolveCategory("gaming"), "gaming");
  assert.equal(resolveCategory("Gaming"), "gaming", "legacy display-name URLs must keep working");
  assert.equal(resolveCategory("GAMING"), "gaming");
  assert.equal(resolveCategory("  Gaming  "), "gaming");
  assert.equal(resolveCategory("electronics"), "electronics");
  assert.equal(resolveCategory("Electronics"), "electronics");
});

test("resolveCategory falls back to 'all' for anything unrecognised", () => {
  for (const input of [null, undefined, "", "   ", "all", "Gamming", "<script>", "1"]) {
    assert.equal(resolveCategory(input), ALL_CATEGORIES, `input: ${JSON.stringify(input)}`);
  }
});

test("categoryFields never returns a mismatched id/name pair", () => {
  for (const c of CATEGORIES) {
    assert.deepEqual(categoryFields(c.id), { category: c.name, categoryId: c.id });
    assert.deepEqual(categoryFields(c.name), { category: c.name, categoryId: c.id });
    assert.deepEqual(categoryFields(c.name.toUpperCase()), {
      category: c.name,
      categoryId: c.id,
    });
  }
  const fallback = categoryFields("not-a-category");
  assert.equal(categoryName(fallback.categoryId), fallback.category);
});

test("selection labels: 'All Products' only when nothing is selected", () => {
  assert.equal(categorySelectionLabel(ALL_CATEGORIES), "All Products");
  assert.equal(categorySelectionLabel("gaming"), "Gaming");
  assert.equal(categorySelectionLabel("electronics"), "Electronics");
});

test("navigation lists are drawn from the canonical categories and don't overlap", () => {
  assert.deepEqual(
    PRIMARY_NAV_CATEGORIES.map((c) => c.name),
    ["Electronics", "Fashion", "Home", "Gaming", "Beauty", "Sports"],
    "the storefront's primary nav categories",
  );
  for (const c of [...PRIMARY_NAV_CATEGORIES, ...SECONDARY_NAV_CATEGORIES]) {
    assert.ok(isCategoryId(c.id), `nav entry is not a canonical category: ${c.id}`);
    assert.equal(categoryName(c.id), c.name);
  }
  const primary = new Set(PRIMARY_NAV_CATEGORY_IDS as readonly string[]);
  for (const c of SECONDARY_NAV_CATEGORIES) {
    assert.equal(primary.has(c.id), false, `${c.id} listed twice`);
  }
  // Together they cover the whole catalog — no category is unreachable.
  assert.deepEqual(
    [...PRIMARY_NAV_CATEGORIES, ...SECONDARY_NAV_CATEGORIES].map((c) => c.id).sort(),
    [...CATEGORY_IDS].sort(),
  );
});
