// data/product-renders.json record → data/product-images.json entry (provider "local-3d-render":
// an original 3D scene rendered locally with three.js — not a photograph, not generative AI).
// Shared by render-products.mjs (writes the entries after rendering the picks) and
// assemble-manifest.mjs (re-applies them, so re-assembling never drops a render).

const REPO = "https://github.com/mishrasem18-ai/commerce-intelligence-lab";
export const RENDER_PROVIDER = "local-3d-render";
export const RENDER_SIZE = 1024;
const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

export function renderManifestEntry(render, { category, samples, tool }) {
  const scene = `scripts/images/render/products/${render.slug}.js`;
  const variant = render.candidates?.find((c) => c.seed === render.seed)?.variant ?? "";
  return {
    noun: render.noun,
    slug: render.slug,
    category,
    provider: RENDER_PROVIDER,
    origin_page_url: `${REPO}/blob/main/${scene}`,
    file_url: "",
    file_width: RENDER_SIZE,
    file_height: RENDER_SIZE,
    crop: { left: 0, top: 0, size: RENDER_SIZE },
    creator: "Aurora Market",
    creator_origin: "Aurora Market",
    license: "CC0",
    license_version: "1.0",
    license_url: CC0_URL,
    attribution:
      `"${render.noun}" 3D render by Aurora Market is dedicated to the public domain (CC0 1.0) (${CC0_URL}). ` +
      `Rendered locally with three.js from an original scene (${scene}, seed ${render.seed}); ` +
      "no photograph and no generative AI were used.",
    modifications: [
      `rendered with three.js (WebGL) at ${RENDER_SIZE * 2}px, ${samples} samples, downsampled to ${RENDER_SIZE}px`,
      "resized",
      "re-encoded as AVIF/WebP",
    ],
    bg_normalised: false,
    confidence: render.confidence,
    confidence_reason: render.confidence_reason,
    alt_text: render.alt_text,
    source_path: `assets/product-source/renders/${render.slug}.png`,
    render: {
      method: "procedural 3D scene rendered locally; no photograph, no generative AI",
      tool,
      scene,
      seed: render.seed,
      variant,
      samples,
    },
  };
}

/** Replace each rendered noun's entry in `entries` (matched by slug); returns the new array. */
export function applyRenders(entries, config) {
  const bySlug = new Map(config.renders.filter((r) => r.alt_text).map((r) => [r.slug, r]));
  return entries.map((e) =>
    bySlug.has(e.slug)
      ? renderManifestEntry(bySlug.get(e.slug), { category: e.category, samples: config.samples, tool: config.tool })
      : e,
  );
}
