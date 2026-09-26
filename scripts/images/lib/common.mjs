// Shared helpers: paths, CLI args, slugs, license parsing, provider URL helpers,
// candidates.json I/O.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCRATCH_ROOT, getJson, withLock } from "./net.mjs";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const SOURCE_DIR = path.join(REPO_ROOT, "assets/product-source");
export const MANIFEST_PATH = path.join(REPO_ROOT, "data/product-images.json");
export const CANDIDATES_ROOT = path.join(SCRATCH_ROOT, "candidates");
export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
export const MIN_SIDE = 800;
export const PREVIEW_WIDTH = 500; // a Wikimedia standard thumbnail bucket
export const COMMONS_FILE_WIDTH = 1920; // standard bucket; 3840 if needed for height
export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];

// Same slug rule as scripts/generate-seed.mjs.
export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

export function die(msg, code = 1) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(code);
}

export function stripHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------- licenses ------

/**
 * Normalise a license description to {code, version, allowed, reason}.
 * code ∈ cc0 | pdm | by | by-sa | <other>. Allowed: cc0, pdm, by, by-sa (any version).
 */
export function classifyLicense({ shortName, url, code: rawCode } = {}) {
  const s = `${rawCode || ""} | ${shortName || ""} | ${url || ""}`.toLowerCase();
  const verMatch = (shortName || "").match(/(\d\.\d)/) || (url || "").match(/\/(\d\.\d)\//) || (rawCode || "").match(/(\d\.\d)/);
  const version = verMatch ? verMatch[1] : null;
  if (/\bnc\b|-nc\b|noncommercial|non-commercial/.test(s)) return { code: "nc", version, allowed: false, reason: "NonCommercial license" };
  if (/\bnd\b|-nd\b|noderiv|no-deriv/.test(s)) return { code: "nd", version, allowed: false, reason: "NoDerivatives license" };
  if (/publicdomain\/zero|\bcc0\b|cc-zero/.test(s)) return { code: "cc0", version: version || "1.0", allowed: true, reason: "CC0" };
  if (/publicdomain\/mark|\bpdm\b|public domain mark/.test(s)) return { code: "pdm", version: version || "1.0", allowed: true, reason: "Public Domain Mark" };
  if (/by-sa|by sa|attribution-sharealike|attribution share ?alike/.test(s)) return { code: "by-sa", version, allowed: true, reason: "CC BY-SA" };
  if (/cc[- ]by\b|licenses\/by\/|attribution license|^\s*by\b/.test(s)) return { code: "by", version, allowed: true, reason: "CC BY" };
  if (/(^|\|)\s*(pd|public domain)\b/.test(s)) return { code: "pdm", version: null, allowed: true, reason: "Public domain (Commons PD tag)" };
  return { code: "other", version, allowed: false, reason: `license not in allow-list (${shortName || rawCode || url || "unknown"})` };
}

export function licenseUrlFor(code, version) {
  const v = version || (code === "by" || code === "by-sa" ? "4.0" : "1.0");
  if (code === "cc0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (code === "pdm") return "https://creativecommons.org/publicdomain/mark/1.0/";
  if (code === "by") return `https://creativecommons.org/licenses/by/${v}/`;
  if (code === "by-sa") return `https://creativecommons.org/licenses/by-sa/${v}/`;
  return null;
}

// ------------------------------------------------------------- commons -----

export function commonsTitleFromUploadUrl(u) {
  // https://upload.wikimedia.org/wikipedia/commons/a/ab/Name.jpg  (or /thumb/a/ab/Name.jpg/500px-Name.jpg)
  const m = u.match(/\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  return m ? "File:" + decodeURIComponent(m[1]).replace(/_/g, " ") : null;
}

/** Choose a downloadable file URL (standard thumb bucket or original) with min side >= 800. */
export function commonsFileChoice(ii) {
  const { width: w, height: h, url, thumburl } = ii;
  const bucketUrl = (bw) => (thumburl && /\/\d+px-/.test(thumburl) ? thumburl.replace(/\/\d+px-/, `/${bw}px-`) : null);
  const tries = [];
  if (w > COMMONS_FILE_WIDTH) tries.push(COMMONS_FILE_WIDTH);
  if (w > 3840) tries.push(3840);
  for (const bw of tries) {
    const bh = Math.round((h * bw) / w);
    const u = bucketUrl(bw);
    if (u && Math.min(bw, bh) >= MIN_SIDE) return { file_url: u, width: bw, height: bh };
  }
  return { file_url: url, width: w, height: h };
}

export const COMMONS_OK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Map a Commons API page (formatversion=2, prop=imageinfo) to a normalized record. */
/** Drop tracking params (utm_*) that the API now appends to thumb URLs. */
export function stripTracking(u) {
  if (!u) return u;
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (k.startsWith("utm_")) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return u;
  }
}

export function commonsPageToRecord(page) {
  const raw = page.imageinfo && page.imageinfo[0];
  if (!raw) return null;
  const ii = { ...raw, url: stripTracking(raw.url), thumburl: stripTracking(raw.thumburl) };
  const em = ii.extmetadata || {};
  const val = (k) => (em[k] ? em[k].value : undefined);
  const lic = classifyLicense({ shortName: val("LicenseShortName"), url: val("LicenseUrl"), code: val("License") });
  const choice = commonsFileChoice(ii);
  return {
    provider: "wikimedia",
    title: page.title,
    origin_page_url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    file_url: choice.file_url,
    width: choice.width,
    height: choice.height,
    original_width: ii.width,
    original_height: ii.height,
    original_url: ii.url,
    mime: ii.mime,
    preview_url: ii.thumburl || ii.url,
    license: lic,
    license_short_name: stripHtml(val("LicenseShortName")),
    license_url: val("LicenseUrl") || licenseUrlFor(lic.code, lic.version),
    creator: stripHtml(val("Artist")),
    credit: stripHtml(val("Credit")),
  };
}

const EXTMETA = "LicenseShortName|License|LicenseUrl|Artist|Credit|UsageTerms|Copyrighted|AttributionRequired";

export function commonsImageinfoParams(extra) {
  return new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(PREVIEW_WIDTH),
    iiextmetadatafilter: EXTMETA,
    iiextmetadatalanguage: "en",
    ...extra,
  });
}

/** Look up Commons files by title (<=50) or pageid. Returns records keyed by title. */
export async function commonsLookup({ titles, pageids }) {
  const params = commonsImageinfoParams(titles ? { titles: titles.join("|") } : { pageids: pageids.join("|") });
  const data = await getJson(`${COMMONS_API}?${params}`);
  const pages = (data.query && data.query.pages) || [];
  return pages.filter((p) => !p.missing).map(commonsPageToRecord).filter(Boolean);
}

// -------------------------------------------------------------- flickr -----

/** Parse a static Flickr URL → {server, id, secret} */
export function parseFlickrStatic(u) {
  const m = u.match(/staticflickr\.com\/(?:\d+\/)?(\d+)\/(\d+)_([0-9a-f]+)(?:_[a-z0-9]+)?\.(?:jpg|png|gif)/i);
  return m ? { server: m[1], id: m[2], secret: m[3] } : null;
}
export function flickrSized(u, suffix) {
  const p = parseFlickrStatic(u);
  if (!p) return null;
  return `https://live.staticflickr.com/${p.server}/${p.id}_${p.secret}${suffix ? "_" + suffix : ""}.jpg`;
}
/** Dimensions at the "_b" size (long edge 1024, never upscaled). */
export function flickrBDims(w, h) {
  if (!w || !h) return { width: null, height: null };
  const long = Math.max(w, h);
  const s = Math.min(1, 1024 / long);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

// -------------------------------------------------------- origin URLs ------

export function normalizeOrigin(u) {
  try {
    const url = new URL(u.replace(/^http:/, "https:"));
    url.hash = "";
    let p = decodeURIComponent(url.pathname).replace(/ /g, "_").replace(/\/+$/, "");
    if (url.host.endsWith("wikimedia.org")) {
      const m = p.match(/\/wiki\/(File:.+)$/i);
      if (m) return `commons:${m[1].replace(/^file:/i, "File:").toLowerCase()}`;
    }
    return `${url.host.toLowerCase()}${p.toLowerCase()}${url.search}`;
  } catch {
    return u;
  }
}

// --------------------------------------------------------- candidates ------

export function candidateDir(slug) {
  return path.join(CANDIDATES_ROOT, slug);
}
export function candidatesPath(slug) {
  return path.join(candidateDir(slug), "candidates.json");
}
export function loadCandidates(slug) {
  try {
    return JSON.parse(fs.readFileSync(candidatesPath(slug), "utf8"));
  } catch {
    return { noun: null, slug, candidates: [] };
  }
}
export async function saveCandidates(slug, data) {
  const p = candidatesPath(slug);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, p);
}
export const withCandidatesLock = (slug, fn) => withLock(`candidates-${slug}`, fn);

export function extFromContentType(ct, url) {
  const c = (ct || "").toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  const m = (url || "").toLowerCase().match(/\.(jpe?g|png|webp)(?:$|\?)/);
  return m ? (m[1] === "jpeg" ? "jpg" : m[1]) : "jpg";
}
