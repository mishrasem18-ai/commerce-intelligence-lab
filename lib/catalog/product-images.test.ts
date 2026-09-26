/**
 * Product images: every seeded product's key resolves to built, budgeted,
 * content-hashed files — or, where no photo passed review, deliberately to
 * the category placeholder — and the manifest records provenance for each.
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_IMAGE_SIZES,
  PRODUCT_IMAGE_WIDTHS,
  productImageKey,
  resolveProductImage,
} from "./product-images.ts";
import { PRODUCT_IMAGE_ASSETS } from "../data/product-image-assets.ts";
import { products, PRODUCT_TYPE_NOUNS } from "../data/products.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const PUBLIC_PRODUCTS = join(ROOT, "public/products");
const MANIFEST_PATH = join(ROOT, "data/product-images.json");
const assetKeys = Object.keys(PRODUCT_IMAGE_ASSETS.images);

test("keys are stable slugs of the product-type noun", () => {
  assert.equal(productImageKey("Wireless Headphones"), "wireless-headphones");
  assert.equal(productImageKey("Sunscreen SPF 50"), "sunscreen-spf-50");
  assert.equal(productImageKey("Systems & Seasons"), "systems-and-seasons");
  assert.equal(productImageKey("USB-C Hub"), "usb-c-hub");
  assert.equal(productImageKey("4K Webcam"), "4k-webcam");
  const all = Object.values(PRODUCT_TYPE_NOUNS).flat().map(productImageKey);
  assert.equal(new Set(all).size, all.length, "two nouns share an image key");
});

test("resolution: built key → responsive, data/URL → plain, unknown → placeholder", () => {
  assert.deepEqual(resolveProductImage(""), { kind: "none" });
  assert.deepEqual(resolveProductImage("no-such-product-type"), { kind: "none" });
  const svg = "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E";
  assert.deepEqual(resolveProductImage(svg), { kind: "url", src: svg });
  assert.equal(resolveProductImage("/products/x.webp").kind, "url");
  for (const key of assetKeys) {
    const r = resolveProductImage(key);
    assert.equal(r.kind, "responsive");
    if (r.kind !== "responsive") continue;
    const { hash } = PRODUCT_IMAGE_ASSETS.images[key as keyof typeof PRODUCT_IMAGE_ASSETS.images];
    for (const ext of ["avif", "webp"]) {
      const srcSet = ext === "avif" ? r.avifSrcSet : r.webpSrcSet;
      assert.equal(
        srcSet,
        PRODUCT_IMAGE_WIDTHS.map((w) => `/products/${key}.${hash}-${w}.${ext} ${w}w`).join(", "),
      );
    }
    assert.match(r.color, /^#[0-9a-f]{6}$/);
  }
});

test("every usage has a sizes hint", () => {
  for (const [usage, sizes] of Object.entries(PRODUCT_IMAGE_SIZES)) {
    assert.ok(sizes.length > 0, usage);
    assert.doesNotMatch(sizes, /,\s*$/, usage);
  }
});

test("every built key has its six files within budget, and nothing stale ships", () => {
  const expected = new Set<string>();
  for (const key of assetKeys) {
    const { hash } = PRODUCT_IMAGE_ASSETS.images[key as keyof typeof PRODUCT_IMAGE_ASSETS.images];
    for (const width of PRODUCT_IMAGE_WIDTHS) {
      for (const ext of ["avif", "webp"]) {
        const name = `${key}.${hash}-${width}.${ext}`;
        expected.add(name);
        const path = join(PUBLIC_PRODUCTS, name);
        assert.ok(existsSync(path), `missing ${name} — run npm run images:build`);
        const bytes = statSync(path).size;
        if (ext === "webp" && width === 640) assert.ok(bytes <= 40 * 1024, `${name} ${bytes} B > 40 KB`);
        if (ext === "webp" && width === 320) assert.ok(bytes <= 15 * 1024, `${name} ${bytes} B > 15 KB`);
      }
    }
  }
  const shipped = existsSync(PUBLIC_PRODUCTS)
    ? readdirSync(PUBLIC_PRODUCTS).filter((f) => /\.(avif|webp)$/.test(f))
    : [];
  assert.deepEqual(shipped.filter((f) => !expected.has(f)), [], "stale files in public/products");
});

test("manifest ↔ catalog ↔ build agree", { skip: !existsSync(MANIFEST_PATH) }, () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    entries: Array<{
      slug: string; noun: string; category: string; provider: string; creator: string;
      license: string; license_url: string; origin_page_url: string; alt_text: string;
      confidence: string; crop: { size: number };
    }>;
  };
  const bySlug = new Map(manifest.entries.map((e) => [e.slug, e]));
  const nouns = Object.entries(PRODUCT_TYPE_NOUNS).flatMap(([category, list]) =>
    list.map((noun) => ({ noun, category, slug: productImageKey(noun) })),
  );
  assert.equal(manifest.entries.length, nouns.length, "one manifest entry per product type");
  for (const { noun, category, slug } of nouns) {
    const entry = bySlug.get(slug);
    assert.ok(entry, `no manifest entry for ${noun}`);
    assert.equal(entry.category, category, slug);
    if (entry.provider === "none") {
      assert.equal(slug in PRODUCT_IMAGE_ASSETS.images, false, `${slug}: placeholder entry must not be built`);
      continue;
    }
    assert.ok(["wikimedia", "flickr"].includes(entry.provider), slug);
    assert.ok(entry.creator && entry.license_url && entry.origin_page_url && entry.alt_text, `${slug}: incomplete credit`);
    assert.doesNotMatch(`${entry.license} ${entry.license_url}`, /\b(nc|nd)\b/i, `${slug}: NC/ND license`);
    assert.ok(entry.crop.size >= 800, `${slug}: crop below 800px`);
    assert.ok(slug in PRODUCT_IMAGE_ASSETS.images, `${slug}: not built — run npm run images:build`);
  }
  // Every seeded product points at a manifest entry of its own category.
  for (const product of products) {
    assert.equal(bySlug.get(product.image)?.category, product.category, product.id);
  }
});
