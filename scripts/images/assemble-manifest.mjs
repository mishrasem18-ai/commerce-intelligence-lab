/**
 * Assemble data/product-images.json from the sourcing run's records.
 *
 *   node scripts/images/assemble-manifest.mjs --results <results.json> [--books <books.json>]
 *
 * <results.json>: array of { noun, category, pick, verdict } — each pick made
 *   by one agent and independently re-checked by another (hard rules + the
 *   license re-read at the ORIGIN page).
 * <books.json>: { base: {...photo record}, titles: [{ noun, slug, author, alt_text }] }.
 *
 * Rules:
 *  - only picks whose verdict passed AND whose license matched the origin are
 *    used; license/creator come from the ORIGIN values the verifier read;
 *  - `creator` is the display credit derived from the origin page (its
 *    Attribution field, else the holding institution named in Credit, else the
 *    Artist); `creator_origin` keeps the origin's Artist value verbatim, which
 *    for museum files is often the object's maker or boilerplate, not a name;
 *  - confidence is the lower of the picker's and the verifier's ratings;
 *  - anything else becomes provider "none" (the storefront shows the category
 *    placeholder) with the reason recorded;
 *  - nouns with a picked studio render in data/product-renders.json are replaced by their
 *    render entry (provider "render", scripts/images/render-products.mjs);
 *  - every cached original must exist, match the recorded file dimensions and
 *    the picked candidate (sidecar), and the crop must be ≥ 800 px and in
 *    bounds — otherwise the script fails.
 */

import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyRenders } from "./lib/render-entry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const results = JSON.parse(readFileSync(arg("results"), "utf8"));
const books = arg("books") ? JSON.parse(readFileSync(arg("books"), "utf8")) : null;

const slugOf = (noun) =>
  noun.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const RANK = { high: 3, medium: 2, low: 1 };
const lower = (a, b) => (RANK[a] <= RANK[b] ? a : b);

const LICENSE_NAMES = { cc0: "CC0", pdm: "Public Domain Mark", by: "CC BY", "by-sa": "CC BY-SA" };
const PROVIDER_NAMES = { wikimedia: "Wikimedia Commons", flickr: "Flickr" };
const BASE_MODIFICATIONS = ["cropped to 1:1", "resized", "metadata stripped", "re-encoded as AVIF/WebP"];

function attribution({ title, creator, code, version, url, provider, extra }) {
  const work = `"${title}"`;
  const license =
    code === "cc0"
      ? `dedicated to the public domain (CC0 ${version || "1.0"})`
      : code === "pdm"
        ? `marked with Public Domain Mark ${version || "1.0"}`
        : `licensed under ${LICENSE_NAMES[code]} ${version}`;
  return `${work} by ${creator || "unknown creator"} is ${license} (${url}), via ${PROVIDER_NAMES[provider]}. ${extra}`;
}

async function checkSource(entry, candidateId) {
  const path = join(root, entry.source_path);
  if (!existsSync(path)) throw new Error(`${entry.slug}: missing ${entry.source_path}`);
  const meta = await sharp(path).metadata();
  const oriented = meta.orientation && meta.orientation >= 5;
  const width = oriented ? meta.height : meta.width;
  const height = oriented ? meta.width : meta.height;
  if (width !== entry.file_width || height !== entry.file_height) {
    throw new Error(`${entry.slug}: cached ${width}x${height} ≠ recorded ${entry.file_width}x${entry.file_height}`);
  }
  const { left, top, size } = entry.crop;
  if (size < 800 || left < 0 || top < 0 || left + size > width || top + size > height) {
    throw new Error(`${entry.slug}: crop ${JSON.stringify(entry.crop)} invalid for ${width}x${height}`);
  }
  if (candidateId !== undefined) {
    const sidecar = join(root, entry.source_path.replace(/\.[a-z]+$/, ".source.json"));
    if (existsSync(sidecar)) {
      const recorded = JSON.parse(readFileSync(sidecar, "utf8"));
      if (recorded.candidate !== candidateId) {
        throw new Error(`${entry.slug}: cached original is candidate ${recorded.candidate}, pick is ${candidateId}`);
      }
    }
  }
}

const entries = [];
const problems = [];

for (const r of results) {
  const slug = slugOf(r.noun);
  const p = r.pick;
  const v = r.verdict;
  const verified = p && p.status === "picked" && v && v.pass && v.license_matches_origin;
  if (!verified) {
    const why = !p
      ? "sourcing agent failed"
      : p.status !== "picked"
        ? `no acceptable open-license photo found (${p.notes?.slice(0, 200) ?? ""})`
        : `rejected by the independent reviewer: ${(v?.violations ?? ["no verdict"]).join("; ")}`;
    entries.push({
      noun: r.noun, slug, category: r.category, provider: "none",
      origin_page_url: "", file_url: "", file_width: 0, file_height: 0,
      crop: { left: 0, top: 0, size: 0 }, creator: "", creator_origin: "", license: "", license_version: "",
      license_url: "", attribution: "", modifications: [], bg_normalised: false,
      confidence: "low", confidence_reason: `Category placeholder shown: ${why}`,
      alt_text: "", source_path: "",
    });
    continue;
  }
  const origin = v.origin_license ?? {};
  const code = origin.license_code ?? p.license_code;
  const version = origin.license_version ?? p.license_version;
  const licenseUrl = origin.license_url ?? p.license_url;
  const creatorOrigin = origin.creator ?? p.creator;
  const creator = origin.credit ?? creatorOrigin;
  const title = decodeURIComponent(
    p.origin_page_url.includes("commons.wikimedia.org")
      ? p.origin_page_url.split("File:")[1]?.replace(/_/g, " ").replace(/\.[a-z]+$/i, "") ?? r.noun
      : r.noun,
  );
  const confidence = lower(p.confidence, v.confidence);
  const entry = {
    noun: r.noun,
    slug,
    category: r.category,
    provider: p.provider,
    origin_page_url: p.origin_page_url,
    file_url: p.file_url,
    file_width: p.file_width,
    file_height: p.file_height,
    crop: p.crop,
    creator,
    creator_origin: creatorOrigin,
    license: LICENSE_NAMES[code] ?? code,
    license_version: version || "1.0",
    license_url: licenseUrl,
    attribution: attribution({
      title, creator, code, version, url: licenseUrl, provider: p.provider,
      extra: "Cropped and resized.",
    }),
    modifications: BASE_MODIFICATIONS,
    bg_normalised: false,
    confidence,
    confidence_reason:
      confidence === v.confidence ? v.confidence_reason : p.confidence_reason,
    alt_text: p.alt_text,
    source_path: p.source_path ?? `assets/product-source/${slug}.jpg`,
  };
  try {
    await checkSource(entry, p.candidate_id);
  } catch (error) {
    problems.push(error.message);
  }
  entries.push(entry);
}

if (books) {
  const b = books.base;
  const code = b.license_code;
  for (const t of books.titles) {
    const entry = {
      noun: t.noun,
      slug: t.slug,
      category: "Books",
      provider: b.provider,
      origin_page_url: b.origin_page_url,
      file_url: b.file_url,
      file_width: 1200,
      file_height: 1200,
      crop: { left: 0, top: 0, size: 1200 },
      creator: b.creator,
      creator_origin: b.creator,
      license: LICENSE_NAMES[code] ?? code,
      license_version: b.license_version || "1.0",
      license_url: b.license_url,
      attribution: attribution({
        title: "blank hardcover book (base photo)", creator: b.creator, code,
        version: b.license_version, url: b.license_url, provider: b.provider,
        extra: `Cover design for the fictional title "${t.noun}" composited by Aurora Market.`,
      }),
      modifications: [...BASE_MODIFICATIONS, "cover design composited"],
      bg_normalised: false,
      confidence: b.confidence ?? "high",
      confidence_reason: b.confidence_reason ?? "Original cover design rendered onto a verified CC0/PDM photo.",
      alt_text: t.alt_text,
      source_path: t.output ?? `assets/product-source/books/${t.slug}.png`,
      composite: { base: b.slug ?? "blank-hardcover-book", title: t.noun, author: t.author },
      base_source: {
        file_width: b.file_width, file_height: b.file_height, crop: b.crop,
        source_path: b.source_path,
      },
    };
    try {
      await checkSource(entry);
    } catch (error) {
      problems.push(error.message);
    }
    entries.push(entry);
  }
}

const RENDERS = join(root, "data/product-renders.json");
if (existsSync(RENDERS)) entries.splice(0, entries.length, ...applyRenders(entries, JSON.parse(readFileSync(RENDERS, "utf8"))));

const order = ["Electronics", "Fashion", "Home", "Sports", "Books", "Beauty", "Furniture", "Accessories", "Gaming", "Toys"];
entries.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.noun.localeCompare(b.noun));

const slugs = new Set(entries.map((e) => e.slug));
if (slugs.size !== entries.length) problems.push("duplicate slugs");
for (const e of entries) {
  if (/\b(nc|nd)\b|non-?commercial|no-?deriv/i.test(`${e.license} ${e.license_url}`)) {
    problems.push(`${e.slug}: NC/ND license ${e.license}`);
  }
  if (e.provider !== "none" && !(e.creator && e.license_url && e.origin_page_url)) {
    problems.push(`${e.slug}: incomplete attribution`);
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

writeFileSync(
  join(root, "data/product-images.json"),
  `${JSON.stringify({ version: 1, generated_by: "scripts/images/assemble-manifest.mjs", entries }, null, 2)}\n`,
);
const tally = entries.reduce((t, e) => ({ ...t, [e.provider === "none" ? "none" : e.confidence]: (t[e.provider === "none" ? "none" : e.confidence] ?? 0) + 1 }), {});
console.log(`✓ data/product-images.json: ${entries.length} entries`, tally);
