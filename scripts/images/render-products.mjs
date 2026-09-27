#!/usr/bin/env node
// Build-time only. Renders studio packshots of simple product types with three.js in headless
// Chromium (the Playwright install used by e2e) — no photo, no network, no API.
//
//   node scripts/images/render-products.mjs --only <slug>[,<slug>] --seeds 1,2,3,4   # candidates
//   node scripts/images/render-products.mjs [--only <slug>]                           # picks
//
// Scenes live in scripts/images/render/products/<slug>.js; the studio (camera framing, lights,
// soft-shadow + anti-aliasing accumulation, tone mapping) in scripts/images/render/studio.js.
// A seed picks the scene's variant (colourway, proportions, camera azimuth) deterministically.
//
// Candidate mode writes <scratch>/renders/<slug>/seed-<n>.png (+ a 256px thumb and log.json).
// Pick mode renders the seed recorded in data/product-renders.json into
// assets/product-source/renders/<slug>.png (1024², the build input for build-product-images.mjs)
// and writes those nouns' entries (provider "render") into data/product-images.json.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { applyRenders, RENDER_SIZE } from "./lib/render-entry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RENDER_DIR = path.join(ROOT, "scripts/images/render");
const CONFIG = path.join(ROOT, "data/product-renders.json");
const SCRATCH = path.join(process.env.IMAGES_SCRATCH ?? path.join(os.tmpdir(), "cil-product-images"), "renders");
const OUT_SIZE = RENDER_SIZE;
const MANIFEST = path.join(ROOT, "data/product-images.json");
const SUPERSAMPLE = 2;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const only = arg("only")?.split(",");
const seeds = arg("seeds")?.split(",").map(Number);
const samples = Number(arg("samples") ?? config.samples);

const jobs = [];
for (const item of config.renders) {
  if (only && !only.includes(item.slug)) continue;
  if (!seeds && !item.alt_text) continue; // not picked yet
  if (seeds) {
    for (const seed of seeds) {
      jobs.push({ slug: item.slug, seed, out: path.join(SCRATCH, item.slug, `seed-${seed}.png`) });
    }
  } else {
    jobs.push({ slug: item.slug, seed: item.seed, out: path.join(ROOT, "assets/product-source/renders", `${item.slug}.png`) });
  }
}
if (jobs.length === 0) {
  console.error("nothing to render (check --only against data/product-renders.json)");
  process.exit(1);
}

const MIME = { ".js": "text/javascript", ".html": "text/html" };
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: OUT_SIZE, height: OUT_SIZE } });
page.on("console", (m) => m.type() === "error" && console.error(`[page] ${m.text()}`));
page.on("pageerror", (e) => console.error(`[page] ${e.message}`));
await page.route("http://render.local/**", async (route) => {
  const url = new URL(route.request().url());
  const file = url.pathname.startsWith("/three/")
    ? path.join(ROOT, "node_modules/three", url.pathname.slice("/three/".length))
    : path.join(RENDER_DIR, url.pathname.slice(1));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
  await route.fulfill({ body: fs.readFileSync(file), contentType: MIME[path.extname(file)] ?? "application/octet-stream" });
});
await page.goto("http://render.local/index.html");
await page.waitForFunction(() => window.renderProduct);
console.log(`WebGL: ${await page.evaluate(() => window.glInfo())}`);

for (const job of jobs) {
  const started = Date.now();
  const result = await page.evaluate(
    ({ slug, seed, size, samples }) => window.renderProduct({ slug, seed, size, samples }),
    { slug: job.slug, seed: job.seed, size: OUT_SIZE * SUPERSAMPLE, samples },
  );
  const png = Buffer.from(result.dataUrl.split(",")[1], "base64");
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  await sharp(png).resize(OUT_SIZE, OUT_SIZE, { kernel: "lanczos3" }).removeAlpha().png().toFile(job.out);
  const record = { slug: job.slug, seed: job.seed, samples, size: OUT_SIZE, supersample: SUPERSAMPLE, ...result.meta };
  if (seeds) {
    await sharp(job.out).resize(256, 256).jpeg({ quality: 85 }).toFile(job.out.replace(/\.png$/, "-thumb.jpg"));
    const logPath = path.join(path.dirname(job.out), "log.json");
    const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : {};
    log[job.seed] = record;
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");
  }
  console.log(`${job.slug} seed ${job.seed} → ${path.relative(ROOT, job.out)} (${((Date.now() - started) / 1000).toFixed(1)} s) ${JSON.stringify(result.meta)}`);
}
await browser.close();

if (!seeds) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  manifest.entries = applyRenders(manifest.entries, { ...config, renders: config.renders.filter((r) => jobs.some((j) => j.slug === r.slug)) });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ data/product-images.json: ${jobs.length} render entr${jobs.length === 1 ? "y" : "ies"} written`);
}
