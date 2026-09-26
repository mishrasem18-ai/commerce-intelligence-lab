#!/usr/bin/env node
// Download a candidate's full-resolution file (cached in assets/product-source/)
// and either render a viewable overview (no crop args) or an 800x800 square crop.
//
//   node scripts/images/crop.mjs --noun "Ceramic Vase" --candidate 7
//   node scripts/images/crop.mjs --noun "Ceramic Vase" --candidate 7 --crop 420,180,1100
//   node scripts/images/crop.mjs --noun "Ceramic Vase" --candidate 7 --focus 0.5,0.55,0.9
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getBuffer } from "./lib/net.mjs";
import {
  parseArgs,
  die,
  slugify,
  SOURCE_DIR,
  REPO_ROOT,
  IMAGE_EXTS,
  MIN_SIDE,
  candidateDir,
  loadCandidates,
  extFromContentType,
} from "./lib/common.mjs";

const args = parseArgs();
const noun = typeof args.noun === "string" ? args.noun.trim() : "";
const id = Number(args.candidate);
if (!noun || !Number.isInteger(id)) die('usage: crop.mjs --noun "<noun>" --candidate <id> [--crop left,top,size | --focus fx,fy,fraction]');
const slug = slugify(noun);
const cand = loadCandidates(slug).candidates.find((c) => c.id === id);
if (!cand) die(`candidate ${id} not found in ${candidateDir(slug)}/candidates.json`);

// ------------------------------------------------------- source cache ------
async function ensureSource() {
  await fsp.mkdir(SOURCE_DIR, { recursive: true });
  const sidecar = path.join(SOURCE_DIR, `${slug}.source.json`);
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(sidecar, "utf8"));
  } catch {}
  if (meta && meta.file_url === cand.file_url && fs.existsSync(path.join(SOURCE_DIR, meta.file))) {
    return { file: path.join(SOURCE_DIR, meta.file), cached: true };
  }
  // Per-candidate scratch cache so switching between candidates doesn't re-download.
  const scratchGlob = fs.readdirSync(candidateDir(slug)).find((f) => new RegExp(`^src-${id}\\.(${IMAGE_EXTS.join("|")})$`).test(f));
  let buffer, ext;
  if (scratchGlob) {
    buffer = await fsp.readFile(path.join(candidateDir(slug), scratchGlob));
    ext = scratchGlob.split(".").pop();
  } else {
    const r = await getBuffer(cand.file_url);
    buffer = r.buffer;
    ext = extFromContentType(r.contentType, cand.file_url);
    await fsp.writeFile(path.join(candidateDir(slug), `src-${id}.${ext}`), buffer);
  }
  for (const e of IMAGE_EXTS) {
    const p = path.join(SOURCE_DIR, `${slug}.${e}`);
    if (fs.existsSync(p)) await fsp.rm(p);
  }
  const file = `${slug}.${ext}`;
  await fsp.writeFile(path.join(SOURCE_DIR, file), buffer);
  await fsp.writeFile(sidecar, JSON.stringify({ noun, slug, candidate: id, file, file_url: cand.file_url, origin_page_url: cand.origin_page_url }, null, 2));
  return { file: path.join(SOURCE_DIR, file), cached: false };
}

const { file, cached } = await ensureSource();
// Coordinates are always in the EXIF-oriented ("as displayed") pixel space.
const meta = await sharp(file).metadata();
const swap = meta.orientation && meta.orientation >= 5;
const W = swap ? meta.height : meta.width;
const H = swap ? meta.width : meta.height;
const rel = path.relative(REPO_ROOT, file);
console.log(`source: ${file} (${cached ? "cached" : "downloaded"})`);
console.log(`file dims: ${W}x${H}${meta.orientation && meta.orientation !== 1 ? ` (EXIF orientation ${meta.orientation} applied)` : ""}  format: ${meta.format}`);
if (cand.width !== W || cand.height !== H) console.log(`note: candidates.json said ${cand.width}x${cand.height}; actual file is ${W}x${H} (use the actual dims)`);
if (Math.min(W, H) < MIN_SIDE) die(`file is only ${W}x${H}; a ${MIN_SIDE}x${MIN_SIDE} crop is impossible — pick another candidate`, 2);

const dir = candidateDir(slug);

if (!args.crop && !args.focus) {
  // Overview: downscaled full image + a copy with a labelled coordinate grid (file pixels).
  const scale = Math.min(1, 1200 / Math.max(W, H));
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const base = await sharp(file).rotate().resize(w, h).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
  const fullPath = path.join(dir, `full-${id}.jpg`);
  await fsp.writeFile(fullPath, base);
  const step = [100, 200, 250, 500, 1000].find((s) => Math.max(W, H) / s <= 12) || 1000;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
  for (let x = step; x < W; x += step) {
    const px = Math.round(x * scale);
    svg += `<line x1="${px}" y1="0" x2="${px}" y2="${h}" stroke="#ff00ff" stroke-opacity="0.6" stroke-width="1"/>`;
    svg += `<text x="${px + 2}" y="14" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#ff00ff" stroke="#000" stroke-width="0.3">${x}</text>`;
  }
  for (let y = step; y < H; y += step) {
    const py = Math.round(y * scale);
    svg += `<line x1="0" y1="${py}" x2="${w}" y2="${py}" stroke="#ff00ff" stroke-opacity="0.6" stroke-width="1"/>`;
    svg += `<text x="2" y="${py - 2}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#ff00ff" stroke="#000" stroke-width="0.3">${y}</text>`;
  }
  svg += `</svg>`;
  const gridPath = path.join(dir, `full-${id}-coords.jpg`);
  await sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(gridPath);
  console.log(`overview: ${fullPath} (${w}x${h}, scale ${scale.toFixed(4)} => file px = overview px / ${scale.toFixed(4)})`);
  console.log(`overview with file-pixel gridlines every ${step}px: ${gridPath}`);
  console.log(`largest possible square: size ${Math.min(W, H)} (e.g. --crop ${Math.floor((W - Math.min(W, H)) / 2)},${Math.floor((H - Math.min(W, H)) / 2)},${Math.min(W, H)})`);
  console.log(JSON.stringify({ candidate: id, source_file: rel, file_width: W, file_height: H }));
  process.exit(0);
}

let left, top, size;
if (args.crop) {
  const parts = String(args.crop).split(",").map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) die("--crop must be left,top,size (integers, file pixels)");
  [left, top, size] = parts.map(Math.round);
  if (size < MIN_SIDE) die(`crop size ${size} < ${MIN_SIDE}`, 2);
  if (left < 0 || top < 0 || left + size > W || top + size > H)
    die(`crop ${left},${top},${size} is out of bounds for ${W}x${H} (needs left+size<=${W}, top+size<=${H})`, 2);
} else {
  const parts = String(args.focus).split(",").map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) die("--focus must be fx,fy,fraction (0..1 each)");
  const [fx, fy, frac] = parts;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1 || frac <= 0 || frac > 1) die("--focus values must be within 0..1 (fraction > 0)");
  size = Math.round(frac * Math.min(W, H));
  if (size < MIN_SIDE) die(`focus fraction ${frac} gives size ${size} < ${MIN_SIDE} (min fraction ${(MIN_SIDE / Math.min(W, H)).toFixed(3)})`, 2);
  left = Math.min(Math.max(0, Math.round(fx * W - size / 2)), W - size);
  top = Math.min(Math.max(0, Math.round(fy * H - size / 2)), H - size);
}

const out = path.join(dir, `crop-${id}.jpg`);
await sharp(file)
  .rotate()
  .extract({ left, top, width: size, height: size })
  .resize(800, 800, { kernel: "lanczos3" })
  .flatten({ background: "#ffffff" })
  .jpeg({ quality: 90 })
  .toFile(out);
console.log(`crop: ${out} (800x800)`);
console.log(JSON.stringify({ candidate: id, crop: { left, top, size }, source_file: rel, file_url: cand.file_url, file_width: W, file_height: H }));
