#!/usr/bin/env node
// Build-time only. Renders docs/product-images-contact-sheet.png from data/product-images.json:
// every noun's final 1:1 crop (or its placeholder status), labelled with the noun and the
// confidence, grouped by category, for human review after sourcing.
//
//   node scripts/images/contact-sheet.mjs [--out docs/product-images-contact-sheet.png]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outArg = process.argv.indexOf("--out");
const out = path.resolve(root, outArg === -1 ? "docs/product-images-contact-sheet.png" : process.argv[outArg + 1]);

const { entries } = JSON.parse(readFileSync(path.join(root, "data/product-images.json"), "utf8"));
const TILE = 168;
const LABEL = 36;
const GAP = 8;
const COLS = 12;
const HEADER = 56;
const BADGE = { high: "#15803d", medium: "#b45309", low: "#b91c1c", none: "#52525b" };

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const status = (e) => (e.provider === "none" ? "none" : e.confidence);

async function tile(e) {
  const s = status(e);
  const image =
    e.provider === "none"
      ? await sharp({ create: { width: TILE, height: TILE, channels: 3, background: "#e4e4e7" } })
          .composite([{
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><text x="${TILE / 2}" y="${TILE / 2 + 5}" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#52525b" text-anchor="middle">placeholder</text></svg>`,
            ),
          }])
          .png()
          .toBuffer()
      : await sharp(path.join(root, e.source_path))
          .rotate()
          .extract({ left: e.crop.left, top: e.crop.top, width: e.crop.size, height: e.crop.size })
          .resize(TILE, TILE)
          .png()
          .toBuffer();
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${LABEL}">` +
      `<rect width="100%" height="100%" fill="#ffffff"/>` +
      `<rect x="0" y="4" width="10" height="10" rx="2" fill="${BADGE[s]}"/>` +
      `<text x="14" y="13" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${BADGE[s]}">${s}</text>` +
      `<text x="0" y="30" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#18181b">${esc(e.noun.length > 24 ? `${e.noun.slice(0, 23)}…` : e.noun)}</text>` +
      `</svg>`,
  );
  return sharp({ create: { width: TILE, height: TILE + LABEL, channels: 3, background: "#ffffff" } })
    .composite([{ input: image, left: 0, top: 0 }, { input: label, left: 0, top: TILE }])
    .png()
    .toBuffer();
}

const tiles = await Promise.all(entries.map(tile));
const rows = Math.ceil(entries.length / COLS);
const width = COLS * (TILE + GAP) + GAP;
const height = HEADER + rows * (TILE + LABEL + GAP) + GAP;
const counts = entries.reduce((t, e) => ({ ...t, [status(e)]: (t[status(e)] ?? 0) + 1 }), {});
const header = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER}">` +
    `<text x="${GAP}" y="26" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="bold" fill="#18181b">Aurora Market product images — ${entries.length} nouns</text>` +
    `<text x="${GAP}" y="46" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#52525b">high ${counts.high ?? 0} · medium ${counts.medium ?? 0} · low ${counts.low ?? 0} · placeholder ${counts.none ?? 0} — final 1:1 crops, source: data/product-images.json</text>` +
    `</svg>`,
);

await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
  .composite([
    { input: header, left: 0, top: 0 },
    ...tiles.map((input, i) => ({
      input,
      left: GAP + (i % COLS) * (TILE + GAP),
      top: HEADER + GAP + Math.floor(i / COLS) * (TILE + LABEL + GAP),
    })),
  ])
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(out);
console.log(`✓ ${path.relative(root, out)} (${width}x${height}, ${entries.length} tiles)`, counts);
