#!/usr/bin/env node
// Search Openverse (Wikimedia/Flickr only) or Wikimedia Commons for candidate
// product photos, append them to candidates/<slug>/candidates.json and render
// a numbered contact sheet (grid.jpg).
//
//   node scripts/images/search.mjs --noun "Ceramic Vase" --query "ceramic vase white background" [--provider auto|openverse|commons] [--limit 20]
import fsp from "node:fs/promises";
import sharp from "sharp";
import { getJson, getBuffer, openverseRefusal, readOpenverseStateSync, BudgetError } from "./lib/net.mjs";
import {
  parseArgs,
  die,
  slugify,
  COMMONS_API,
  COMMONS_OK_MIME,
  MIN_SIDE,
  commonsImageinfoParams,
  commonsLookup,
  commonsPageToRecord,
  commonsTitleFromUploadUrl,
  classifyLicense,
  flickrSized,
  flickrBDims,
  normalizeOrigin,
  candidateDir,
  loadCandidates,
  saveCandidates,
  withCandidatesLock,
  stripHtml,
} from "./lib/common.mjs";
import { renderGrids, previewPath } from "./lib/grid.mjs";

const args = parseArgs();
const noun = typeof args.noun === "string" ? args.noun.trim() : "";
const query = typeof args.query === "string" ? args.query.trim() : "";
if (!noun || !query) die('usage: search.mjs --noun "<noun>" --query "<q>" [--provider openverse|commons|auto] [--limit 20]');
const provider = args.provider || "auto";
if (!["auto", "openverse", "commons"].includes(provider)) die(`bad --provider ${provider}`);
const limit = Math.max(1, Math.min(50, Number(args.limit) || 20));
const slug = slugify(noun);

const licHint = (lic) => (lic.version && lic.code !== "cc0" && lic.code !== "pdm" ? `${lic.code} ${lic.version}` : lic.code);

function fromCommonsRecord(r, dropped) {
  if (!r) return null;
  if (!COMMONS_OK_MIME.has(r.mime)) return dropped.push(`${r.title}: mime ${r.mime}`), null;
  if (!r.license.allowed) return dropped.push(`${r.title}: ${r.license.reason}`), null;
  if (Math.min(r.original_width, r.original_height) < MIN_SIDE || Math.min(r.width, r.height) < MIN_SIDE)
    return dropped.push(`${r.title}: too small ${r.original_width}x${r.original_height}`), null;
  return {
    provider: "wikimedia",
    title: r.title.replace(/^File:/, ""),
    origin_page_url: r.origin_page_url,
    file_url: r.file_url,
    preview_url: r.preview_url,
    width: r.width,
    height: r.height,
    original_width: r.original_width,
    original_height: r.original_height,
    license_hint: licHint(r.license),
    creator_hint: r.creator,
  };
}

async function searchOpenverse() {
  const params = new URLSearchParams({
    q: query,
    license: "cc0,pdm,by,by-sa",
    license_type: "commercial,modification",
    category: "photograph",
    source: "wikimedia,flickr",
    page_size: String(Math.min(20, limit)),
  });
  const data = await getJson(`https://api.openverse.org/v1/images/?${params}`, { openverseNoun: slug });
  const results = (data.results || []).filter((r) => r.source === "wikimedia" || r.source === "flickr");
  const dropped = [];
  const out = [];
  // Wikimedia hits: re-read authoritative size/license/thumbs from the Commons API (one batched call).
  const wm = results.filter((r) => r.source === "wikimedia");
  const titles = [...new Set(wm.map((r) => commonsTitleFromUploadUrl(r.url)).filter(Boolean))];
  const byTitle = new Map();
  if (titles.length) {
    for (const rec of await commonsLookup({ titles })) byTitle.set(rec.title, rec);
  }
  for (const r of results) {
    if (r.source === "wikimedia") {
      const t = commonsTitleFromUploadUrl(r.url);
      const c = fromCommonsRecord(byTitle.get(t), dropped);
      if (c) out.push(c);
      else if (!byTitle.get(t)) dropped.push(`${r.title}: not found on Commons`);
    } else {
      const lic = classifyLicense({ code: r.license, url: r.license_url, shortName: `${r.license} ${r.license_version || ""}` });
      if (!lic.allowed) {
        dropped.push(`${r.title}: ${lic.reason}`);
        continue;
      }
      const file_url = flickrSized(r.url, "b");
      const dims = flickrBDims(r.width, r.height);
      if (!file_url || !dims.width || Math.min(dims.width, dims.height) < MIN_SIDE) {
        dropped.push(`${r.title}: flickr _b too small (${dims.width}x${dims.height})`);
        continue;
      }
      out.push({
        provider: "flickr",
        title: stripHtml(r.title),
        origin_page_url: r.foreign_landing_url,
        file_url,
        preview_url: flickrSized(r.url, "z"),
        width: dims.width,
        height: dims.height,
        original_width: r.width,
        original_height: r.height,
        license_hint: licHint(lic),
        creator_hint: stripHtml(r.creator),
      });
    }
  }
  return { out, dropped, total: data.result_count, raw: results.length };
}

async function searchCommons() {
  const params = commonsImageinfoParams({
    generator: "search",
    gsrsearch: `filetype:bitmap filew:>${MIN_SIDE - 1} fileh:>${MIN_SIDE - 1} ${query}`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
  });
  const data = await getJson(`${COMMONS_API}?${params}`);
  const pages = ((data.query && data.query.pages) || []).sort((a, b) => (a.index || 0) - (b.index || 0));
  const dropped = [];
  const out = pages.map((p) => fromCommonsRecord(commonsPageToRecord(p), dropped)).filter(Boolean);
  return { out, dropped, total: data.query?.searchinfo?.totalhits ?? null, raw: pages.length };
}

// ---------------------------------------------------------------- main -----
let used = provider;
let res;
if (provider !== "commons") {
  const why = openverseRefusal(slug);
  if (why) {
    process.stderr.write(`[search] Openverse refused (${why}); falling back to Commons\n`);
    used = "commons";
  } else {
    try {
      used = "openverse";
      res = await searchOpenverse();
    } catch (e) {
      if (!(e instanceof BudgetError)) throw e;
      process.stderr.write(`[search] Openverse refused (${e.message}); falling back to Commons\n`);
      used = "commons";
    }
  }
}
if (!res) {
  used = "commons";
  res = await searchCommons();
}

const added = await withCandidatesLock(slug, async () => {
  const data = loadCandidates(slug);
  data.noun = noun;
  data.slug = slug;
  const seen = new Set(data.candidates.map((c) => normalizeOrigin(c.origin_page_url)));
  let next = data.candidates.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const added = [];
  for (const c of res.out) {
    const key = normalizeOrigin(c.origin_page_url);
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = { id: next++, ...c, query, searched_via: used };
    data.candidates.push(rec);
    added.push(rec);
  }
  data.queries = [...(data.queries || []), { query, provider: used, at: new Date().toISOString(), added: added.length }];
  await saveCandidates(slug, data);
  return added;
});

await fsp.mkdir(candidateDir(slug), { recursive: true });
for (const c of added) {
  if (!c.preview_url) continue;
  try {
    const { buffer } = await getBuffer(c.preview_url);
    await sharp(buffer).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toFile(previewPath(slug, c.id));
  } catch (e) {
    process.stderr.write(`[search] preview failed for #${c.id}: ${e.message}\n`);
  }
}

const grids = await withCandidatesLock(slug, async () => renderGrids(slug, loadCandidates(slug).candidates));
const all = loadCandidates(slug).candidates;
const addedIds = new Set(added.map((c) => c.id));

console.log(`noun: ${noun}  slug: ${slug}  provider: ${used}  query: "${query}"`);
console.log(`results: ${res.raw} raw, ${res.out.length} usable, ${added.length} new (total candidates ${all.length})`);
if (res.dropped.length) console.log(`dropped: ${res.dropped.length} (${res.dropped.slice(0, 6).join("; ")}${res.dropped.length > 6 ? "; ..." : ""})`);
console.log(`candidates: ${candidateDir(slug)}/candidates.json`);
for (const g of grids) console.log(`grid: ${g}`);
console.log("id  new src  WxH        license    title");
for (const c of all) {
  console.log(
    `${String(c.id).padStart(3)} ${addedIds.has(c.id) ? " +  " : "    "}${c.provider === "flickr" ? "F" : "W"}   ${`${c.width}x${c.height}`.padEnd(10)} ${String(c.license_hint).padEnd(10)} ${String(c.title).slice(0, 60)}`,
  );
}
if (used === "openverse" || provider !== "commons") {
  const st = readOpenverseStateSync();
  console.log(`openverse budget: sustained=${st.sustained_available ?? "?"} burst=${st.burst_available ?? "?"} noun_queries=${(st.per_noun || {})[slug] || 0}/2`);
}
