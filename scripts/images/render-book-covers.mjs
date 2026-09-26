#!/usr/bin/env node
// Build-time only. Renders one product photo per fictional book title from ONE real,
// CC0-licensed photo of a cloth hardcover (data/book-covers.json -> base).
//
//   node scripts/images/render-book-covers.mjs [--config data/book-covers.json] [--only <slug>] [--debug]
//
// Pipeline (all in the base photo's file-pixel space, front-facing so the cover is a rectangle):
//   1. Luminance of the photo. The base cover carries printed text, so inside geometry.clean we
//      detect it (pixel much brighter than a 15px median), dilate the mask, and re-synthesise the
//      cloth there: smooth lighting = quadratic surface fitted to the text-free blurred luminance,
//      weave = random 48px high-pass patches quilted from text-free parts of the same board.
//   2. Per title: flat design (cover colour + SVG typography/motif) is multiplied by the cleaned
//      shading map (L / mean L), so the photo's lighting, hinge groove, edges and weave survive
//      and the type looks printed on cloth. The background/shadow is left untouched.
//   3. Square crop (base.crop) -> output.size PNG at assets/product-source/books/<slug>.png.
// No network access. Needs only sharp and the cached base photo (fetch it with
// scripts/images/fetch-sources.mjs or crop.mjs if missing).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

// Same rule as lib/catalog/product-images.ts: "&" -> "and", then non-alphanumerics -> "-".
export const bookSlug = (s) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Solve A x = b (small dense system, Gaussian elimination with partial pivoting).
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

async function grey(input, W, H, op) {
  let s = sharp(input, W ? { raw: { width: W, height: H, channels: 1 } } : undefined);
  if (!W) s = s.greyscale();
  s = op ? op(s) : s;
  const { data, info } = await s.extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || data.length !== info.width * info.height) throw new Error("expected a 1-channel buffer");
  return data;
}

// ---------------------------------------------------------------------------------------------
// 1. Text-free shading map of the cover.
async function buildShading(srcPath, W, H, geo) {
  const L8 = await grey(srcPath);
  const soft = await grey(srcPath, 0, 0, (s) => s.blur(1.5));
  const med = await grey(srcPath, 0, 0, (s) => s.median(15));
  const low8 = await grey(srcPath, 0, 0, (s) => s.blur(5));
  const { board, clean } = geo;

  // Printed-text mask (white type on grey cloth), dilated.
  const mask0 = Buffer.alloc(W * H);
  for (let y = board.top; y < board.bottom; y++)
    for (let x = board.left; x < board.right; x++) {
      const i = y * W + x;
      if (soft[i] - med[i] > 15) mask0[i] = 255; // lightly blurred so the cloth weave does not trigger it
    }
  const mask = await grey(mask0, W, H, (s) => s.blur(4).threshold(1));

  // Lighting: quadratic fit to blurred luminance at text-free board pixels.
  const inset = 14;
  const nx = (x) => (x - (board.left + board.right) / 2) / 500;
  const ny = (y) => (y - (board.top + board.bottom) / 2) / 500;
  const basis = (x, y) => {
    const u = nx(x), v = ny(y);
    return [1, u, v, u * u, v * v, u * v];
  };
  const A = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const bv = new Array(6).fill(0);
  for (let y = board.top + inset; y < board.bottom - inset; y += 3)
    for (let x = board.left + inset; x < board.right - inset; x += 3) {
      const i = y * W + x;
      if (mask[i]) continue;
      const f = basis(x, y);
      for (let r = 0; r < 6; r++) {
        bv[r] += f[r] * low8[i];
        for (let c = 0; c < 6; c++) A[r][c] += f[r] * f[c];
      }
    }
  const coef = solve(A, bv);
  const fit = (x, y) => basis(x, y).reduce((s, f, k) => s + f * coef[k], 0);

  // Allowed patch origins: P x P boxes fully inside the board (inset) with no text mask.
  const P = 48, STEP = 40;
  const IW = W + 1;
  const integ = new Uint32Array(IW * (H + 1));
  for (let y = 0; y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      run += mask[y * W + x] ? 1 : 0;
      integ[(y + 1) * IW + x + 1] = integ[y * IW + x + 1] + run;
    }
  }
  const boxSum = (x, y, w, h) =>
    integ[(y + h) * IW + x + w] - integ[y * IW + x + w] - integ[(y + h) * IW + x] + integ[y * IW + x];
  const origins = [];
  for (let y = board.top + 8; y + P <= board.bottom - 8; y += 2)
    for (let x = board.left + 8; x + P <= board.right - 8; x += 2)
      if (boxSum(x, y, P, P) === 0) origins.push([x, y]);
  if (origins.length < 50) throw new Error(`only ${origins.length} text-free cloth patches found`);

  // Quilt the high-pass weave over the clean rect; variance-preserving overlap blend.
  const cw = clean.right - clean.left, ch = clean.bottom - clean.top;
  const acc = new Float32Array(cw * ch), wsum2 = new Float32Array(cw * ch);
  const rand = mulberry32(20260926);
  const OV = P - STEP;
  const tent = (u) => Math.min(1, (u + 1) / OV, (P - u) / OV);
  for (let ty = -OV; ty < ch; ty += STEP)
    for (let tx = -OV; tx < cw; tx += STEP) {
      const [sx, sy] = origins[Math.floor(rand() * origins.length)];
      for (let v = 0; v < P; v++) {
        const yy = ty + v;
        if (yy < 0 || yy >= ch) continue;
        for (let u = 0; u < P; u++) {
          const xx = tx + u;
          if (xx < 0 || xx >= cw) continue;
          const si = (sy + v) * W + sx + u;
          const w = tent(u) * tent(v);
          const j = yy * cw + xx;
          acc[j] += w * (L8[si] - low8[si]);
          wsum2[j] += w * w;
        }
      }
    }

  // Clean luminance: original everywhere, synthesis inside clean rect with a feathered edge.
  const Lc = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) Lc[i] = L8[i];
  const F = 14;
  for (let yy = 0; yy < ch; yy++)
    for (let xx = 0; xx < cw; xx++) {
      const x = clean.left + xx, y = clean.top + yy;
      const d = Math.min(xx, yy, cw - 1 - xx, ch - 1 - yy);
      const wr = Math.min(1, d / F);
      const j = yy * cw + xx;
      const synth = fit(x, y) + (wsum2[j] > 0 ? acc[j] / Math.sqrt(wsum2[j]) : 0);
      const i = y * W + x;
      Lc[i] = wr * synth + (1 - wr) * L8[i];
    }

  let sum = 0, n = 0;
  for (let y = board.top + 40; y < board.bottom - 40; y += 2)
    for (let x = board.left + 40; x < board.right - 40; x += 2) {
      sum += Lc[y * W + x];
      n++;
    }
  return { Lc, Lref: sum / n, mask };
}

// ---------------------------------------------------------------------------------------------
// 2. Typography helpers.
const measureCache = new Map();
async function measure(text, { size, family, weight = 400, spacing = 0, style = "normal" }) {
  const key = JSON.stringify([text, size, family, weight, spacing, style]);
  if (measureCache.has(key)) return measureCache.get(key);
  const w = Math.ceil(size * text.length * 1.2 + 200), h = Math.ceil(size * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="20" y="${size * 1.3}" font-family="${esc(family)}" font-size="${size}" font-weight="${weight}" font-style="${style}" letter-spacing="${spacing}" fill="#000">${esc(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  measureCache.set(key, info.width);
  return info.width;
}

async function fitTitle(lines, family, maxW, maxSize, minSize = 60) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const widths = await Promise.all(lines.map((l) => measure(l, { size, family })));
    if (Math.max(...widths) <= maxW) return { size, widths };
  }
  const widths = await Promise.all(lines.map((l) => measure(l, { size: minSize, family })));
  return { size: minSize, widths };
}

function motifSvg(kind, cx, cy, c, scale = 1) {
  const s = scale;
  const g = (inner) => `<g transform="translate(${cx} ${cy}) scale(${s})">${inner}</g>`;
  switch (kind) {
    case "rule":
      return g(
        `<line x1="-120" y1="0" x2="-22" y2="0" stroke="${c}" stroke-width="3"/>` +
          `<line x1="22" y1="0" x2="120" y2="0" stroke="${c}" stroke-width="3"/>` +
          `<circle cx="0" cy="0" r="7" fill="${c}"/>`,
      );
    case "diamond":
      return g(
        `<line x1="-140" y1="0" x2="-30" y2="0" stroke="${c}" stroke-width="3"/>` +
          `<line x1="30" y1="0" x2="140" y2="0" stroke="${c}" stroke-width="3"/>` +
          `<rect x="-14" y="-14" width="28" height="28" transform="rotate(45)" fill="none" stroke="${c}" stroke-width="3"/>` +
          `<rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" fill="${c}"/>`,
      );
    case "ring":
      return g(
        `<circle cx="0" cy="0" r="78" fill="none" stroke="${c}" stroke-width="4"/>` +
          `<circle cx="0" cy="0" r="52" fill="none" stroke="${c}" stroke-width="1.5"/>` +
          `<circle cx="55" cy="-55" r="12" fill="${c}"/>` +
          `<circle cx="0" cy="0" r="16" fill="${c}"/>`,
      );
    case "dial": {
      let ticks = "";
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const r0 = k % 6 === 0 ? 62 : 70;
        ticks += `<line x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * 80).toFixed(1)}" y2="${(Math.sin(a) * 80).toFixed(1)}" stroke="${c}" stroke-width="${k % 6 === 0 ? 4 : 2}"/>`;
      }
      return g(
        `<circle cx="0" cy="0" r="92" fill="none" stroke="${c}" stroke-width="4"/>` +
          ticks +
          `<line x1="0" y1="0" x2="38" y2="-44" stroke="${c}" stroke-width="5" stroke-linecap="round"/>` +
          `<circle cx="0" cy="0" r="9" fill="${c}"/>`,
      );
    }
    case "waves": {
      let p = "";
      for (let k = 0; k < 3; k++) {
        const y = k * 26 - 26;
        let d = `M -180 ${y}`;
        for (let x = -180; x <= 180; x += 6) d += ` L ${x} ${(y + Math.sin((x / 360) * Math.PI * 6 + k * 0.9) * 10).toFixed(1)}`;
        p += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${k === 1 ? 4 : 2.5}" stroke-linecap="round"/>`;
      }
      return g(p);
    }
    case "dots": {
      // A small "atlas" of dots on a faint grid; anchored at its top-left.
      let p = "";
      const rand = mulberry32(7);
      for (let r = 0; r < 5; r++)
        for (let q = 0; q < 9; q++) {
          const x = q * 56, y = r * 56;
          const big = rand() < 0.14;
          p += `<circle cx="${x}" cy="${y}" r="${big ? 13 : 4.5}" fill="${big ? c : "none"}" stroke="${c}" stroke-width="${big ? 0 : 2}"/>`;
        }
      return g(p);
    }
    case "bars": {
      // Rising bars (momentum); anchored at bottom-left.
      let p = "";
      for (let k = 0; k < 7; k++) {
        const h = 40 + k * k * 7 + k * 12;
        p += `<rect x="${k * 44}" y="${-h}" width="24" height="${h}" fill="${c}"/>`;
      }
      p += `<line x1="-10" y1="10" x2="${6 * 44 + 34}" y2="10" stroke="${c}" stroke-width="3"/>`;
      return g(p);
    }
    case "grid": {
      // Blueprint plate; anchored at its top-left, 440 x 300.
      let p = "";
      for (let x = 0; x <= 440; x += 40) p += `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="${c}" stroke-width="1" opacity="0.45"/>`;
      for (let y = 0; y <= 300; y += 40) p += `<line x1="0" y1="${y}" x2="440" y2="${y}" stroke="${c}" stroke-width="1" opacity="0.45"/>`;
      p += `<rect x="0" y="0" width="440" height="300" fill="none" stroke="${c}" stroke-width="3"/>`;
      p += `<rect x="80" y="80" width="200" height="140" fill="none" stroke="${c}" stroke-width="3"/>`;
      p += `<circle cx="280" cy="80" r="60" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="10 8"/>`;
      p += `<line x1="80" y1="250" x2="280" y2="250" stroke="${c}" stroke-width="2"/>`;
      p += `<line x1="80" y1="242" x2="80" y2="258" stroke="${c}" stroke-width="2"/><line x1="280" y1="242" x2="280" y2="258" stroke="${c}" stroke-width="2"/>`;
      return g(p);
    }
    case "gears": {
      const gear = (gx, gy, r, teeth, rot) => {
        let d = "";
        const n = teeth * 4;
        for (let k = 0; k < n; k++) {
          const a = rot + (k / n) * Math.PI * 2;
          const rr = k % 4 < 2 ? r : r - 16;
          d += `${k ? "L" : "M"} ${(gx + Math.cos(a) * rr).toFixed(1)} ${(gy + Math.sin(a) * rr).toFixed(1)} `;
        }
        return `<path d="${d}Z" fill="none" stroke="${c}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="${gx}" cy="${gy}" r="${(r * 0.32).toFixed(1)}" fill="none" stroke="${c}" stroke-width="3.5"/>`;
      };
      return g(gear(0, 0, 96, 12, 0) + gear(150, 96, 66, 8, 0.2));
    }
    default:
      return "";
  }
}

function designSvg(W, H, board, t, fonts, fit) {
  const { cover, accent, text } = t.colourway;
  const serif = fonts.serif;
  const bw = board.right - board.left;
  const cx = board.left + bw / 2;
  const parts = [];
  const lh = Math.round(fit.size * 1.06);

  if (t.frame === "single" || t.frame === "double") {
    const i1 = 44;
    parts.push(
      `<rect x="${board.left + i1}" y="${board.top + i1}" width="${bw - 2 * i1}" height="${board.bottom - board.top - 2 * i1}" fill="none" stroke="${accent}" stroke-width="4"/>`,
    );
    if (t.frame === "double") {
      const i2 = 60;
      parts.push(
        `<rect x="${board.left + i2}" y="${board.top + i2}" width="${bw - 2 * i2}" height="${board.bottom - board.top - 2 * i2}" fill="none" stroke="${accent}" stroke-width="1.6"/>`,
      );
    }
  }

  if (t.layout === "left") {
    const x = board.left + 96;
    const first = board.top + 150 + fit.size * 0.72;
    parts.push(`<rect x="${x}" y="${board.top + 118}" width="120" height="9" fill="${accent}"/>`);
    t.lines.forEach((l, k) =>
      parts.push(
        `<text x="${x}" y="${first + 30 + k * lh}" font-family="${esc(serif)}" font-size="${fit.size}" fill="${text}">${esc(l)}</text>`,
      ),
    );
    const titleBottom = first + 30 + (t.lines.length - 1) * lh;
    // Motif in the middle band, left-anchored.
    const mTop = titleBottom + 150;
    if (t.motif === "bars") parts.push(motifSvg("bars", x + 4, mTop + 300, accent, 0.82));
    else if (t.motif === "grid") parts.push(motifSvg("grid", x, mTop + 20, accent));
    else if (t.motif === "dots") parts.push(motifSvg("dots", x + 6, mTop + 40, accent));
    else if (t.motif === "gears") parts.push(motifSvg("gears", x + 110, mTop + 150, accent));
    else parts.push(motifSvg(t.motif, x + 150, mTop + 120, accent));
    parts.push(
      `<text x="${x}" y="${board.bottom - 176}" font-family="${esc(serif)}" font-size="40" letter-spacing="5" fill="${text}">${esc(t.author.toUpperCase())}</text>`,
    );
    parts.push(
      `<text x="${x}" y="${board.bottom - 106}" font-family="${esc(serif)}" font-size="25" font-style="italic" letter-spacing="2" fill="${accent}">${esc(t.imprint)}</text>`,
    );
  } else {
    const first = board.top + 300 + fit.size * 0.72;
    t.lines.forEach((l, k) =>
      parts.push(
        `<text x="${cx}" y="${first + k * lh}" text-anchor="middle" font-family="${esc(serif)}" font-size="${fit.size}" fill="${text}">${esc(l)}</text>`,
      ),
    );
    const titleBottom = first + (t.lines.length - 1) * lh;
    const motifY = t.motif === "ring" || t.motif === "dial" ? titleBottom + 205 : titleBottom + 120;
    parts.push(motifSvg(t.motif, cx, motifY, accent));
    parts.push(
      `<text x="${cx}" y="${board.bottom - 236}" text-anchor="middle" font-family="${esc(serif)}" font-size="40" letter-spacing="6" fill="${text}">${esc(t.author.toUpperCase())}</text>`,
    );
    parts.push(
      `<text x="${cx}" y="${board.bottom - 126}" text-anchor="middle" font-family="${esc(serif)}" font-size="25" font-style="italic" letter-spacing="2" fill="${accent}">${esc(t.imprint)}</text>`,
    );
  }
  void cover;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfgPath = path.resolve(REPO_ROOT, args.config || "data/book-covers.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const { base, output, fonts } = cfg;
  const geo = base.geometry;
  const srcPath = path.resolve(REPO_ROOT, base.source_file);
  if (!fs.existsSync(srcPath))
    throw new Error(`base photo missing: ${base.source_file} (run scripts/images/fetch-sources.mjs)`);
  const meta = await sharp(srcPath).metadata();
  const W = meta.width, H = meta.height;
  if (W !== base.file_width || H !== base.file_height)
    throw new Error(`base photo is ${W}x${H}, config expects ${base.file_width}x${base.file_height}`);
  const { data: rgb } = await sharp(srcPath).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });

  const { Lc, Lref, mask } = await buildShading(srcPath, W, H, geo);
  const outDir = path.resolve(REPO_ROOT, output.dir);
  fs.mkdirSync(outDir, { recursive: true });

  if (args.debug) {
    const g8 = Buffer.alloc(W * H);
    for (let i = 0; i < W * H; i++) g8[i] = Math.max(0, Math.min(255, Math.round(Lc[i])));
    await sharp(g8, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(outDir, "_debug-clean-luma.png"));
    await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(outDir, "_debug-text-mask.png"));
  }

  const { book } = geo;
  // Tinted area = book rect plus the spine head/tail caps (geometry.caps), each feathered 1.5px
  // so the tint meets the background without a hard seam.
  const rects = [book, ...(geo.caps || [])];
  const feather = (d) => Math.max(0, Math.min(1, (d + 0.5) / 1.5));
  const cover = (x, y) => {
    let a = 0;
    for (const r of rects) a = Math.max(a, feather(Math.min(x - r.left, r.right - 1 - x, y - r.top, r.bottom - 1 - y)));
    return a;
  };
  const yMin = Math.min(...rects.map((r) => r.top)) - 1, yMax = Math.max(...rects.map((r) => r.bottom));
  const xMin = Math.min(...rects.map((r) => r.left)) - 1, xMax = Math.max(...rects.map((r) => r.right));
  const slugs = [];
  for (const t of cfg.titles) {
    const slug = bookSlug(t.title);
    if (slug !== t.slug) throw new Error(`slug mismatch for "${t.title}": config ${t.slug}, rule ${slug}`);
    if (args.only && args.only !== slug) continue;
    const board = geo.board;
    const maxW = t.layout === "left" ? board.right - board.left - 96 - 100 : board.right - board.left - 190;
    const fit = await fitTitle(t.lines, fonts.serif, maxW, 132);
    const svg = designSvg(W, H, board, t, fonts, fit);
    const { data: des } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const cov = hexToRgb(t.colourway.cover);
    const lumCover = 0.299 * cov[0] + 0.587 * cov[1] + 0.114 * cov[2];
    // Dark cloth shows its weave a little more than a pure multiply would suggest.
    const k = lumCover < 90 ? 1.35 : 1.15;
    const out = Buffer.from(rgb);
    for (let y = yMin; y <= yMax; y++)
      for (let x = xMin; x <= xMax; x++) {
        const a = cover(x, y);
        if (a <= 0) continue;
        const i = y * W + x;
        const s = 1 + k * (Lc[i] / Lref - 1);
        const da = des[i * 4 + 3] / 255;
        for (let c = 0; c < 3; c++) {
          const flat = cov[c] * (1 - da) + des[i * 4 + c] * da;
          const v = flat * s;
          out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(a * v + (1 - a) * rgb[i * 3 + c])));
        }
      }
    const { left, top, size } = base.crop;
    const file = path.join(outDir, `${slug}.png`);
    await sharp(out, { raw: { width: W, height: H, channels: 3 } })
      .extract({ left, top, width: size, height: size })
      .resize(output.size, output.size, { kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toFile(file);
    slugs.push(slug);
    console.log(`${slug}: title ${fit.size}px (${fit.widths.join("/")} of ${maxW}) -> ${path.relative(REPO_ROOT, file)}`);
  }
  console.log(JSON.stringify({ rendered: slugs.length, dir: path.relative(REPO_ROOT, outDir), Lref: +Lref.toFixed(2) }));
}

main().catch((e) => {
  process.stderr.write(`ERROR: ${e.message}\n`);
  process.exit(1);
});
