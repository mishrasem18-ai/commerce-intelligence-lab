/**
 * data/product-images.json — the provenance record for every product image:
 * where each photo came from, who made it, its license (as re-checked at the
 * origin) and what we changed. Product types with no usable open-license photo
 * can instead carry an original studio render (provider "render",
 * scripts/images/render-products.mjs). It drives the build pipeline
 * (scripts/build-product-images.mjs), source re-downloads
 * (scripts/images/fetch-sources.mjs) and the /credits page.
 */

import type { ProductCategory } from "@/lib/data/products";

export interface ProductImageManifestEntry {
  noun: string;
  /** Image key (= products.image). */
  slug: string;
  category: ProductCategory;
  /**
   * "none": no acceptable open-license photo — the category placeholder is used.
   * "render": an original three.js studio render made for this store (no photo).
   */
  provider: "wikimedia" | "flickr" | "render" | "none";
  /** The page that states the license (Commons file page / Flickr photo page; for renders, the scene source). */
  origin_page_url: string;
  /** The exact file downloaded (reproducible build input). */
  file_url: string;
  file_width: number;
  file_height: number;
  /** 1:1 crop in EXIF-oriented file pixels. */
  crop: { left: number; top: number; size: number };
  creator: string;
  /** e.g. "CC BY-SA", "CC0", "Public Domain Mark". */
  license: string;
  license_version: string;
  license_url: string;
  /** Ready-to-display TASL attribution line. */
  attribution: string;
  modifications: string[];
  bg_normalised: boolean;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  alt_text: string;
  /** Cached original (gitignored), relative to the repo root. */
  source_path: string;
  /** Books only: a fictional cover composited onto the base photo. */
  composite?: { base: string; title: string; author: string };
  /** Renders only: the scene module and the seed/sample count it was rendered with. */
  render?: { scene: string; seed: number; samples: number };
}

export interface ProductImageManifest {
  version: number;
  entries: ProductImageManifestEntry[];
}

/** "Cropped, resized, background normalised" — the human summary for credits. */
export function describeModifications(entry: ProductImageManifestEntry): string {
  if (entry.provider === "render") return "Rendered with three.js, resized";
  const parts = ["cropped", "resized"];
  if (entry.bg_normalised) parts.push("background normalised");
  if (entry.composite) parts.push("cover design composited");
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function providerLabel(provider: ProductImageManifestEntry["provider"]): string {
  if (provider === "wikimedia") return "Wikimedia Commons";
  if (provider === "flickr") return "Flickr";
  if (provider === "render") return "Scene source";
  return "";
}
