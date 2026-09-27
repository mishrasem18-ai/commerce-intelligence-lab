#!/usr/bin/env node
// Reproducibility entry point: (re)download every manifest entry's file_url into
// assets/product-source/ and verify the pixel dimensions match the manifest.
//
//   node scripts/images/fetch-sources.mjs [--force] [--only <slug>] [--manifest data/product-images.json] [--out assets/product-source]
//
// Book covers: the base photo in data/book-covers.json is fetched like any entry, then
// render-book-covers.mjs regenerates any missing cover (all of them with --force).
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { getBuffer } from "./lib/net.mjs";
import { parseArgs, die, slugify, SOURCE_DIR, MANIFEST_PATH, REPO_ROOT, IMAGE_EXTS, extFromContentType } from "./lib/common.mjs";

const args = parseArgs();
const manifestPath = path.resolve(REPO_ROOT, typeof args.manifest === "string" ? args.manifest : MANIFEST_PATH);
const outDir = path.resolve(REPO_ROOT, typeof args.out === "string" ? args.out : SOURCE_DIR);
const force = args.force === true;
const only = typeof args.only === "string" ? args.only : null;

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (e) {
  die(`cannot read manifest ${manifestPath}: ${e.message}`);
}
// Accept an array, {items|images|products: [...]}, or an object keyed by slug.
let entries = Array.isArray(manifest)
  ? manifest
  : manifest.entries || manifest.items || manifest.images || manifest.products || Object.entries(manifest).filter(([, v]) => v && typeof v === "object" && v.file_url).map(([k, v]) => ({ slug: k, ...v }));
if (!Array.isArray(entries)) die("manifest has no entries array");
entries = entries.map((e) => ({ ...e, slug: e.slug || (e.noun ? slugify(e.noun) : null) }));
// Placeholder entries (provider "none") have no source; composited book covers
// are regenerated from their base photo by render-book-covers.mjs, studio renders
// (provider "local-3d-render") by render-products.mjs.
entries = entries.filter((e) => e.provider !== "none" && e.provider !== "local-3d-render" && !e.composite);
const BOOKS_CONFIG = path.join(REPO_ROOT, "data/book-covers.json");
const books = fs.existsSync(BOOKS_CONFIG) ? JSON.parse(fs.readFileSync(BOOKS_CONFIG, "utf8")) : null;
if (books?.base) entries.push({ ...books.base, slug: slugify(books.base.noun) });
if (only) entries = entries.filter((e) => e.slug === only);

const disp = (p) => (p.startsWith(REPO_ROOT + path.sep) ? path.relative(REPO_ROOT, p) : p);

async function orientedDims(file) {
  const m = await sharp(file).metadata();
  return m.orientation && m.orientation >= 5 ? { w: m.height, h: m.width } : { w: m.width, h: m.height };
}

await fsp.mkdir(outDir, { recursive: true });
let ok = 0, downloaded = 0, failed = 0;
for (const e of entries) {
  const tag = e.slug || "(no slug)";
  try {
    if (!e.slug || !e.file_url || !e.file_width || !e.file_height) throw new Error("entry needs slug|noun, file_url, file_width, file_height");
    const sidecar = path.join(outDir, `${e.slug}.source.json`);
    let side = null;
    try {
      side = JSON.parse(fs.readFileSync(sidecar, "utf8"));
    } catch {}
    const explicit = e.source_file ? path.join(outDir, path.basename(e.source_file)) : null;
    let existing = explicit && fs.existsSync(explicit) ? explicit : null;
    if (!existing && !explicit) {
      const f = IMAGE_EXTS.map((x) => path.join(outDir, `${e.slug}.${x}`)).find((p) => fs.existsSync(p));
      if (f) existing = f;
    }
    const stale = existing && side && side.file_url && side.file_url !== e.file_url;
    let file = existing;
    if (force || !existing || stale) {
      const r = await getBuffer(e.file_url);
      const ext = explicit ? path.extname(explicit).slice(1) : extFromContentType(r.contentType, e.file_url);
      for (const x of IMAGE_EXTS) {
        const p = path.join(outDir, `${e.slug}.${x}`);
        if (fs.existsSync(p)) await fsp.rm(p);
      }
      file = explicit || path.join(outDir, `${e.slug}.${ext}`);
      await fsp.writeFile(file, r.buffer);
      await fsp.writeFile(sidecar, JSON.stringify({ slug: e.slug, noun: e.noun, file: path.basename(file), file_url: e.file_url, origin_page_url: e.origin_page_url }, null, 2));
      downloaded++;
    }
    const { w, h } = await orientedDims(file);
    if (w !== Number(e.file_width) || h !== Number(e.file_height)) {
      throw new Error(`dimension mismatch: file ${w}x${h} vs manifest ${e.file_width}x${e.file_height} (${disp(file)})`);
    }
    console.log(`ok   ${tag.padEnd(28)} ${w}x${h}  ${disp(file)}${file === existing && !force && !stale ? " (present)" : " (downloaded)"}`);
    ok++;
  } catch (err) {
    console.log(`FAIL ${tag.padEnd(28)} ${err.message}`);
    failed++;
  }
}
console.log(`\n${entries.length} entries: ${ok} ok (${downloaded} downloaded), ${failed} failed`);

if (books?.base && !only && !failed) {
  const dir = path.resolve(REPO_ROOT, books.output.dir);
  const missing = books.titles.filter((t) => !fs.existsSync(path.join(dir, `${t.slug}.png`)));
  if (force || missing.length > 0) {
    console.log(`rendering ${force ? "all" : missing.length} book cover(s)…`);
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts/images/render-book-covers.mjs")], { stdio: "inherit" });
    if (r.status !== 0) failed++;
  } else {
    console.log(`book covers: all ${books.titles.length} present`);
  }
}
process.exit(failed ? 1 : 0);
