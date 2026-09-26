// Contact-sheet rendering: every candidate as a ~240px tile with its id burned in.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { candidateDir } from "./common.mjs";

const TILE = 240;
const GAP = 6;
const COLS = 6;
const PER_PAGE = 30;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function previewPath(slug, id) {
  return path.join(candidateDir(slug), `prev-${id}.jpg`);
}

function labelSvg(c) {
  const idText = String(c.id);
  const boxW = 22 + idText.length * 26;
  const prov = c.provider === "flickr" ? "F" : "W";
  const info = `${prov} ${c.width}x${c.height} ${c.license_hint || "?"}`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
      `<rect x="0" y="0" width="${boxW}" height="54" rx="6" fill="#000" fill-opacity="0.85"/>` +
      `<text x="${boxW / 2}" y="42" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="42" font-weight="700" fill="#ffea00" text-anchor="middle">${esc(idText)}</text>` +
      `<rect x="0" y="${TILE - 24}" width="${TILE}" height="24" fill="#000" fill-opacity="0.7"/>` +
      `<text x="6" y="${TILE - 7}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="16" fill="#fff">${esc(info)}</text>` +
      `</svg>`,
  );
}

async function tile(slug, c) {
  const p = previewPath(slug, c.id);
  let base;
  if (fs.existsSync(p)) {
    base = await sharp(p)
      .resize(TILE, TILE, { fit: "contain", background: { r: 238, g: 238, b: 238 } })
      .flatten({ background: "#eeeeee" })
      .toBuffer();
  } else {
    base = await sharp({
      create: { width: TILE, height: TILE, channels: 3, background: "#f4c7c7" },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><text x="120" y="130" font-family="Helvetica, Arial, sans-serif" font-size="20" text-anchor="middle">no preview</text></svg>`,
          ),
        },
      ])
      .png()
      .toBuffer();
  }
  return sharp(base).composite([{ input: labelSvg(c) }]).png().toBuffer();
}

/** (Re)render grid.jpg or grid-1.jpg, grid-2.jpg … Returns the written paths. */
export async function renderGrids(slug, candidates) {
  const dir = candidateDir(slug);
  for (const f of await fsp.readdir(dir)) if (/^grid(-\d+)?\.jpg$/.test(f)) await fsp.rm(path.join(dir, f));
  if (!candidates.length) return [];
  const pages = [];
  for (let i = 0; i < candidates.length; i += PER_PAGE) pages.push(candidates.slice(i, i + PER_PAGE));
  const out = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const list = pages[pi];
    const cols = Math.min(COLS, list.length);
    const rows = Math.ceil(list.length / cols);
    const W = cols * TILE + (cols + 1) * GAP;
    const H = rows * TILE + (rows + 1) * GAP;
    const comps = [];
    for (let i = 0; i < list.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      comps.push({ input: await tile(slug, list[i]), left: GAP + col * (TILE + GAP), top: GAP + row * (TILE + GAP) });
    }
    const file = path.join(dir, pages.length === 1 ? "grid.jpg" : `grid-${pi + 1}.jpg`);
    await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
      .composite(comps)
      .jpeg({ quality: 85 })
      .toFile(file);
    out.push(file);
  }
  return out;
}
