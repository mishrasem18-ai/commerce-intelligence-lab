/**
 * Product image keys → self-hosted responsive sources.
 *
 * A product's `image` (D1 `products.image`) is a short KEY — the slug of its
 * product-type noun ("wireless-headphones"), shared by every product of that
 * type. Build output (scripts/build-product-images.mjs) lives in
 * /public/products as `<key>.<hash>-<width>.<avif|webp>`; the generated map
 * (lib/data/product-image-assets.ts) holds each key's content hash and
 * dominant colour. Content-hashed URLs are served immutable (public/_headers).
 *
 * Anything that is not a known key — the SVG data-URI placeholder of a
 * runtime-created product (`categoryPlaceholderImage`), an absolute URL, or a
 * key whose photo is not built — resolves accordingly, so the gradient/icon
 * fallback still covers every case.
 *
 * Runtime-agnostic (no React/DOM) so the Node test runner can exercise it.
 */

import { PRODUCT_IMAGE_ASSETS } from "@/lib/data/product-image-assets";

export const PRODUCT_IMAGE_WIDTHS: readonly number[] = PRODUCT_IMAGE_ASSETS.widths;
const IMAGES: Readonly<Record<string, { readonly hash: string; readonly color: string }>> =
  PRODUCT_IMAGE_ASSETS.images;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Sunscreen SPF 50" → "sunscreen-spf-50"; "Systems & Seasons" → "systems-and-seasons". */
export function productImageKey(noun: string): string {
  return noun
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ResolvedProductImage =
  | {
      kind: "responsive";
      key: string;
      avifSrcSet: string;
      webpSrcSet: string;
      /** Middle size, for browsers without <picture>/srcset support. */
      fallbackSrc: string;
      /** Dominant colour — painted behind the image while it loads. */
      color: string;
    }
  | { kind: "url"; src: string }
  | { kind: "none" };

export function resolveProductImage(image: string | null | undefined): ResolvedProductImage {
  if (!image) return { kind: "none" };
  if (KEY_PATTERN.test(image)) {
    const asset = IMAGES[image];
    if (!asset) return { kind: "none" };
    const url = (width: number, ext: string) => `/products/${image}.${asset.hash}-${width}.${ext}`;
    const srcSet = (ext: string) =>
      PRODUCT_IMAGE_WIDTHS.map((width) => `${url(width, ext)} ${width}w`).join(", ");
    return {
      kind: "responsive",
      key: image,
      avifSrcSet: srcSet("avif"),
      webpSrcSet: srcSet("webp"),
      fallbackSrc: url(640, "webp"),
      color: asset.color,
    };
  }
  if (/^(data:image\/|https?:\/\/|\/)/.test(image)) return { kind: "url", src: image };
  return { kind: "none" };
}

/**
 * `sizes` per usage, derived from each layout's CSS (max-w-7xl = 1280px
 * container, Tailwind breakpoints sm 640 / lg 1024 / xl 1280).
 */
export const PRODUCT_IMAGE_SIZES = {
  /** Store grids: 2 / 3 / 4 columns (shop, home). */
  storeCard: "(min-width: 1280px) 292px, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw",
  /** Store PDP gallery: full width, half of the container from lg. */
  pdpGallery: "(min-width: 1280px) 592px, (min-width: 1024px) 46vw, 100vw",
  /** Admin product detail: two-thirds column beside a 256px sidebar. */
  adminGallery: "(min-width: 1024px) 55vw, 100vw",
  /** Admin catalog cards. */
  adminCard: "(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw",
  /** Cart line thumbnail (size-20 / sm:size-24). */
  cartThumb: "96px",
  /** 40px thumbnails: admin table rows, header search suggestions. */
  thumb40: "40px",
  /** /credits list thumbnails (size-16). */
  creditThumb: "64px",
} as const;

export type ProductImageUsage = keyof typeof PRODUCT_IMAGE_SIZES;
