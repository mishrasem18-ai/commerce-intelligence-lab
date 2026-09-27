// data/product-renders.json record → data/product-images.json entry (provider "render").
// Shared by render-products.mjs (writes the entries after rendering the picks) and
// assemble-manifest.mjs (re-applies them, so re-assembling never drops a render).

const REPO = "https://github.com/mishrasem18-ai/commerce-intelligence-lab";
export const RENDER_SIZE = 1024;

export function renderManifestEntry(render, { category, samples }) {
  const scene = `scripts/images/render/products/${render.slug}.js`;
  return {
    noun: render.noun,
    slug: render.slug,
    category,
    provider: "render",
    origin_page_url: `${REPO}/blob/main/${scene}`,
    file_url: "",
    file_width: RENDER_SIZE,
    file_height: RENDER_SIZE,
    crop: { left: 0, top: 0, size: RENDER_SIZE },
    creator: "Aurora Market",
    creator_origin: "Aurora Market",
    license: "MIT",
    license_version: "",
    license_url: `${REPO}/blob/main/LICENSE`,
    attribution:
      `Original studio render of a generic ${render.noun.toLowerCase()} by Aurora Market, made with three.js ` +
      `(${scene}, seed ${render.seed}). No photograph used.`,
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
    render: { scene, seed: render.seed, samples },
  };
}

/** Replace each rendered noun's entry in `entries` (matched by slug); returns the new array. */
export function applyRenders(entries, config) {
  const bySlug = new Map(config.renders.filter((r) => r.alt_text).map((r) => [r.slug, r]));
  return entries.map((e) => (bySlug.has(e.slug) ? renderManifestEntry(bySlug.get(e.slug), { category: e.category, samples: config.samples }) : e));
}
