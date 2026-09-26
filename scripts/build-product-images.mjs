/**
 * Product image pipeline — BUILD-TIME ONLY (sharp never ships to the Worker;
 * `npm run check:worker` and lib/data/product-image-assets.test.ts enforce it).
 *
 * For every entry in data/product-images.json whose original is cached under
 * assets/product-source/ (re-download with `node scripts/images/fetch-sources.mjs`,
 * books re-render with `node scripts/images/render-book-covers.mjs`):
 *
 *   1. apply EXIF orientation, then the manifest's 1:1 crop (file pixels);
 *   2. strip all metadata (sharp's default: no EXIF/XMP/ICC is written; pixels
 *      are converted to sRGB);
 *   3. encode AVIF + WebP at 320 / 640 / 960 px into public/products/ with
 *      content-hashed names: `<slug>.<hash>-<width>.<avif|webp>`, where the
 *      hash covers all six outputs, so any change yields new immutable URLs;
 *   4. enforce the byte budget — 640px WebP ≤ 40 KB, 320px WebP ≤ 15 KB. WebP
 *      quality steps down from 80 to a floor of 50 with a sharp (lanczos3)
 *      resample. Dense textures (rugs, knits, weaves, wood grain) can miss the
 *      budget even then, so the resample softens in fixed steps — mitchell
 *      kernel + 0.6px blur (quality floor 40), then + 0.8px blur (floor 30) —
 *      and the AVIF of that width uses the same resample. Still over budget ⇒
 *      the script fails (exit 1) and writes nothing.
 *
 * Writes lib/data/product-image-assets.ts (slug → hash + dominant colour),
 * the only thing the client bundle needs to build srcsets, and deletes stale
 * files in public/products/.
 *
 *   node scripts/build-product-images.mjs            # build everything
 *   node scripts/build-product-images.mjs --check    # verify outputs are up to date (no writes)
 *   … --manifest=<json> --out=<dir> --map=<json>     # dry run elsewhere
 */

import sharp from "sharp";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
// Overrides exist for dry runs against a scratch directory.
const MANIFEST = arg("manifest") ?? join(root, "data/product-images.json");
const OUT_DIR = arg("out") ?? join(root, "public/products");
const MAP_OUT = arg("map") ?? join(root, "lib/data/product-image-assets.ts");

export const WIDTHS = [320, 640, 960];
const WEBP_BUDGET = { 320: 15 * 1024, 640: 40 * 1024 };
const WEBP_QUALITY_START = 80;
/** Resample ladder, tried in order until the WebP fits its budget. */
const RESAMPLE = [
  { name: "sharp", kernel: "lanczos3", blur: 0, floor: 50 },
  { name: "soft", kernel: "mitchell", blur: 0.6, floor: 40 },
  { name: "softer", kernel: "mitchell", blur: 0.8, floor: 30 },
];
const WEBP_QUALITY_FLOOR = RESAMPLE.at(-1).floor;
const AVIF_QUALITY = 50;
const CONCURRENCY = 4;
const FILE_PATTERN = /^[a-z0-9-]+\.[0-9a-f]{10}-(320|640|960)\.(avif|webp)$/;

const checkOnly = process.argv.includes("--check");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const entries = manifest.entries.filter((e) => e.provider !== "none" && e.source_path);

function resized(square, width, resample) {
  const image = square.clone().resize(width, width, { kernel: resample.kernel });
  return resample.blur ? image.blur(resample.blur) : image;
}

async function encodeWebp(square, width) {
  const budget = WEBP_BUDGET[width];
  for (const resample of RESAMPLE) {
    for (let quality = WEBP_QUALITY_START; quality >= resample.floor; quality -= 5) {
      const buffer = await resized(square, width, resample)
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer();
      if (!budget || buffer.length <= budget) return { buffer, quality, resample };
    }
  }
  return null;
}

async function processEntry(entry) {
  const source = join(root, entry.source_path);
  if (!existsSync(source)) {
    return { slug: entry.slug, error: `missing original ${entry.source_path} (run scripts/images/fetch-sources.mjs)` };
  }
  const { left, top, size } = entry.crop;
  // Decode + orient + crop once; every variant resizes from this square.
  const cropped = await sharp(source, { failOn: "error" })
    .rotate()
    .extract({ left, top, width: size, height: size })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .png()
    .toBuffer();
  const square = sharp(cropped);
  const { dominant } = await square.clone().stats();
  const color = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

  const outputs = [];
  for (const width of WIDTHS) {
    const webp = await encodeWebp(square, width);
    if (!webp) {
      return {
        slug: entry.slug,
        error: `${width}px WebP exceeds ${WEBP_BUDGET[width] / 1024} KB even at quality ${WEBP_QUALITY_FLOOR}`,
      };
    }
    const avif = await resized(square, width, webp.resample)
      .avif({ quality: AVIF_QUALITY, effort: 5, chromaSubsampling: "4:2:0" })
      .toBuffer();
    const resample = webp.resample.name;
    outputs.push({ width, ext: "webp", buffer: webp.buffer, quality: webp.quality, resample });
    outputs.push({ width, ext: "avif", buffer: avif, quality: AVIF_QUALITY, resample });
  }

  const hash = createHash("sha256");
  for (const o of outputs) hash.update(o.buffer);
  const digest = hash.digest("hex").slice(0, 10);
  return {
    slug: entry.slug,
    hash: digest,
    color,
    files: outputs.map((o) => ({ ...o, name: `${entry.slug}.${digest}-${o.width}.${o.ext}` })),
  };
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

const results = await pool(entries, processEntry);
const failures = results.filter((r) => r.error);
for (const f of failures) console.error(`✗ ${f.slug}: ${f.error}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} image(s) failed; nothing written.`);
  process.exit(1);
}

const map = {
  version: 1,
  widths: WIDTHS,
  images: Object.fromEntries(
    results
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((r) => [r.slug, { hash: r.hash, color: r.color }]),
  ),
};
const mapJson =
  "// GENERATED by scripts/build-product-images.mjs — do not edit.\n" +
  "// Product image key → content hash + dominant colour (see lib/catalog/product-images.ts).\n" +
  `export const PRODUCT_IMAGE_ASSETS = ${JSON.stringify(map, null, 2)} as const;\n`;
const expected = new Set(results.flatMap((r) => r.files.map((f) => f.name)));

if (checkOnly) {
  const current = existsSync(MAP_OUT) ? readFileSync(MAP_OUT, "utf8") : "";
  const missing = [...expected].filter((name) => !existsSync(join(OUT_DIR, name)));
  if (current !== mapJson || missing.length > 0) {
    console.error("public/products is out of date — run: node scripts/build-product-images.mjs");
    process.exit(1);
  }
  console.log(`✓ ${results.length} images up to date`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const r of results) {
  for (const f of r.files) {
    const path = join(OUT_DIR, f.name);
    if (!existsSync(path)) writeFileSync(path, f.buffer);
  }
}
let removed = 0;
for (const name of readdirSync(OUT_DIR)) {
  if (FILE_PATTERN.test(name) && !expected.has(name)) {
    rmSync(join(OUT_DIR, name));
    removed++;
  }
}
writeFileSync(MAP_OUT, mapJson);

// Report
const kb = (n) => (n / 1024).toFixed(1).padStart(5);
let total = 0;
const rows = results.map((r) => {
  const by = Object.fromEntries(r.files.map((f) => [`${f.ext}${f.width}`, f]));
  total += r.files.reduce((sum, f) => sum + f.buffer.length, 0);
  const soft = WIDTHS.map((w) => by[`webp${w}`].resample).filter((n) => n !== "sharp");
  return `${r.slug.padEnd(28)} webp ${kb(by.webp320.buffer.length)} ${kb(by.webp640.buffer.length)} ${kb(by.webp960.buffer.length)} KB (q${by.webp320.quality}/${by.webp640.quality}${soft.length ? ` resample ${WIDTHS.map((w) => by[`webp${w}`].resample).join("/")}` : ""})  avif ${kb(by.avif320.buffer.length)} ${kb(by.avif640.buffer.length)} ${kb(by.avif960.buffer.length)} KB`;
});
console.log(rows.join("\n"));
const worst640 = Math.max(...results.map((r) => r.files.find((f) => f.ext === "webp" && f.width === 640).buffer.length));
const worst320 = Math.max(...results.map((r) => r.files.find((f) => f.ext === "webp" && f.width === 320).buffer.length));
console.log(
  `\n✓ ${results.length} images, ${expected.size} files, ${(total / 1024 / 1024).toFixed(2)} MB total; ` +
    `largest WebP 640 ${kb(worst640)} KB (≤ 40), 320 ${kb(worst320)} KB (≤ 15); removed ${removed} stale file(s).`,
);
