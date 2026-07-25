/**
 * D1 product/category data-integrity tests.
 *
 * Run: node --experimental-strip-types --import ./test/register.mjs \
 *        --test lib/db/catalog-integrity.test.ts   (part of `npm test`).
 *
 * READ-ONLY with respect to the real database: the rows come from the checked-in
 * seed migration, and the D1 surface is an in-memory fake injected through the
 * `__setTestDb` seam. No production (or local) D1 is opened, queried or written.
 *
 * What this proves, end to end:
 *   1. every seeded product references a category that exists in D1;
 *   2. the seeded category of each product agrees with its own product data;
 *   3. `lib/db/products.ts` maps a D1 row to a Product whose canonical
 *      `categoryId` and display `category` come from that one column and match;
 *   4. the storefront's category filter, run over the D1-derived catalog,
 *      returns only products of the requested category.
 * Point 4 is the D1-side counterpart of the `?category=Gaming` regression test
 * in `lib/catalog/shop-query.test.ts`.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { __setTestDb, type D1Database } from "@/lib/db/client";
import { getProducts, getProductsByCategory } from "@/lib/db/products";
import {
  CATEGORIES,
  categoryIdFromName,
  categoryName,
} from "@/lib/catalog/categories";
import { selectShopProducts, parseShopQuery } from "@/lib/catalog/shop-query";
import type { Product } from "@/lib/data/products";

/* -------------------------------------------------------------------------- */
/*  Seed parsing                                                              */
/* -------------------------------------------------------------------------- */

const SEED_SQL = readFileSync(
  fileURLToPath(new URL("../../migrations/0002_seed.sql", import.meta.url)),
  "utf8",
);

/** Split a SQL `VALUES (...)` tuple, honouring `''` escapes inside literals. */
function parseValues(tuple: string): (string | number | null)[] {
  const values: (string | number | null)[] = [];
  let i = 0;
  while (i < tuple.length) {
    const ch = tuple[i];
    if (ch === " " || ch === ",") {
      i += 1;
      continue;
    }
    if (ch === "'") {
      let literal = "";
      i += 1;
      while (i < tuple.length) {
        if (tuple[i] === "'") {
          if (tuple[i + 1] === "'") {
            literal += "'";
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        literal += tuple[i];
        i += 1;
      }
      values.push(literal);
      continue;
    }
    let token = "";
    while (i < tuple.length && tuple[i] !== ",") {
      token += tuple[i];
      i += 1;
    }
    token = token.trim();
    values.push(token.toUpperCase() === "NULL" ? null : Number(token));
  }
  return values;
}

interface SeedRow {
  [column: string]: string | number | null;
}

function parseInserts(table: string): SeedRow[] {
  const pattern = new RegExp(
    `INSERT INTO ${table} \\(([^)]+)\\) VALUES \\((.*)\\);\\s*$`,
    "gm",
  );
  return [...SEED_SQL.matchAll(pattern)].map(([, columnList, tuple]) => {
    const columns = columnList.split(",").map((c) => c.trim());
    const values = parseValues(tuple);
    assert.equal(
      values.length,
      columns.length,
      `seed row column/value mismatch: ${columns.join(",")}`,
    );
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

const seedCategories = parseInserts("categories");
const seedProducts = parseInserts("products");

/* -------------------------------------------------------------------------- */
/*  In-memory D1 fake (products/categories join only)                         */
/* -------------------------------------------------------------------------- */

const categoryNameById = new Map(
  seedCategories.map((row) => [String(row.id), String(row.name)]),
);

/** The rows the real `SELECT ... JOIN categories` in lib/db/products.ts yields. */
function joinedRows(): SeedRow[] {
  return seedProducts
    .filter((product) => categoryNameById.has(String(product.category_id)))
    .map((product) => ({
      ...product,
      category_id: product.category_id,
      category_name: categoryNameById.get(String(product.category_id))!,
    }))
    .sort((a, b) => {
      const byDate = String(b.created_at).localeCompare(String(a.created_at));
      return byDate !== 0 ? byDate : String(a.id).localeCompare(String(b.id));
    });
}

function createSeedBackedD1(): D1Database {
  const rows = joinedRows();
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    all: async () => {
      if (!sql.includes("FROM products p JOIN categories c")) {
        throw new Error(`unexpected SQL in test: ${sql}`);
      }
      const filtered = sql.includes("WHERE c.id = ?")
        ? rows.filter((row) => row.category_id === args[0])
        : rows;
      return { results: filtered as never[], success: true };
    },
    first: async () => {
      const filtered = sql.includes("WHERE p.id = ?")
        ? rows.filter((row) => row.id === args[0])
        : rows;
      return (filtered[0] ?? null) as never;
    },
    run: async () => ({ success: true }),
  });
  return {
    prepare: (sql: string) => statement(sql) as never,
    batch: async () => [],
  } as D1Database;
}

let d1Products: Product[] = [];

before(async () => {
  __setTestDb(createSeedBackedD1());
  d1Products = await getProducts();
});

after(() => {
  __setTestDb(null);
});

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test("the seed defines every category the app knows about, and no others", () => {
  assert.deepEqual(
    seedCategories.map((row) => ({ id: row.id, name: row.name })),
    CATEGORIES.map((category) => ({ id: category.id, name: category.name })),
  );
});

test("every seeded product references an existing category (no orphans)", () => {
  assert.ok(seedProducts.length >= 100, "expected a full seeded catalog");
  for (const product of seedProducts) {
    const categoryId = String(product.category_id);
    assert.ok(
      categoryNameById.has(categoryId),
      `product ${product.id} references unknown category '${categoryId}'`,
    );
  }
});

test("seeded category values are canonical slugs, not display names", () => {
  for (const product of seedProducts) {
    const categoryId = String(product.category_id);
    assert.equal(
      categoryIdFromName(categoryNameById.get(categoryId)!),
      categoryId,
      `product ${product.id}: category '${categoryId}' is not canonical`,
    );
  }
});

test("every category is populated in D1 (no category navigates to an empty page)", () => {
  const counts = new Map<string, number>();
  for (const product of seedProducts) {
    const id = String(product.category_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const category of CATEGORIES) {
    assert.ok((counts.get(category.id) ?? 0) > 0, `no products seeded for ${category.id}`);
  }
});

test("the D1 row mapper derives categoryId and category from one source", () => {
  assert.equal(d1Products.length, seedProducts.length);
  const seedById = new Map(seedProducts.map((row) => [String(row.id), row]));

  for (const product of d1Products) {
    const seeded = seedById.get(product.id);
    assert.ok(seeded, `mapper produced an unknown product ${product.id}`);
    assert.equal(
      product.categoryId,
      String(seeded.category_id),
      `${product.id}: categoryId does not match D1`,
    );
    assert.equal(
      product.category,
      categoryName(product.categoryId),
      `${product.id}: display label does not match its own categoryId`,
    );
    assert.equal(
      product.category,
      categoryNameById.get(product.categoryId),
      `${product.id}: display label does not match the D1 categories table`,
    );
  }
});

test("each product's seeded category agrees with the product's own data", () => {
  // The generated catalog paints the category name into the product image, so
  // the image is an independent witness of the record's true category. This
  // catches a mislabelled row that the id/name mapping alone would not.
  for (const product of d1Products) {
    const label = encodeURIComponent(product.category);
    assert.ok(
      product.image.includes(label),
      `${product.id} (${product.name}) is filed under ${product.category} but its ` +
        `own artwork says otherwise`,
    );
  }
});

test("filtering the D1 catalog by category returns only that category", () => {
  for (const category of CATEGORIES) {
    const query = parseShopQuery({ category: category.id });
    const result = selectShopProducts(d1Products, query);
    assert.ok(result.length > 0, `no buyer-visible D1 products for ${category.id}`);
    for (const product of result) {
      assert.equal(
        product.categoryId,
        category.id,
        `?category=${category.id} returned ${product.name} (${product.category})`,
      );
    }
  }
});

test("REGRESSION: ?category=Gaming over D1 data renders no Electronics product", () => {
  const gaming = selectShopProducts(d1Products, parseShopQuery({ category: "Gaming" }));
  assert.ok(gaming.length > 0);
  for (const product of gaming) {
    assert.equal(product.categoryId, "gaming", `leaked ${product.name}`);
  }
  assert.deepEqual(
    gaming.filter((p) => /bluetooth tracker|wireless charger/i.test(p.name)),
    [],
  );
});

test("getProductsByCategory queries by canonical id and rejects unknown input", async () => {
  for (const input of ["gaming", "Gaming", "GAMING"]) {
    const result = await getProductsByCategory(input);
    assert.ok(result.length > 0, `no rows for ${input}`);
    for (const product of result) assert.equal(product.categoryId, "gaming");
  }
  assert.deepEqual(await getProductsByCategory("not-a-category"), []);
  assert.deepEqual(await getProductsByCategory("all"), []);
});
