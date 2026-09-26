#!/usr/bin/env node
// Re-check a candidate's license AT ORIGIN via a keyless API and print JSON.
//
//   node scripts/images/verify-license.mjs --provider wikimedia --origin "https://commons.wikimedia.org/wiki/File:Foo.jpg"
//   node scripts/images/verify-license.mjs --provider flickr    --origin "https://www.flickr.com/photos/someone/1234567890"
import { request } from "./lib/net.mjs";
import { parseArgs, die, classifyLicense, licenseUrlFor, commonsLookup, stripHtml, flickrSized } from "./lib/common.mjs";

const args = parseArgs();
const provider = args.provider;
const origin = typeof args.origin === "string" ? args.origin.trim() : "";
if (!["wikimedia", "flickr"].includes(provider) || !origin) die("usage: verify-license.mjs --provider <wikimedia|flickr> --origin <origin_page_url>");

let result;
if (provider === "wikimedia") {
  const u = new URL(origin);
  let lookup;
  const curid = u.searchParams.get("curid");
  if (curid) lookup = { pageids: [curid] };
  else {
    const m = decodeURIComponent(u.pathname).match(/\/wiki\/(File:.+)$/i) || [null, u.searchParams.get("title")];
    if (!m[1]) die(`cannot extract a File: title from ${origin}`);
    lookup = { titles: [m[1].replace(/_/g, " ").replace(/^file:/i, "File:")] };
  }
  const [rec] = await commonsLookup(lookup);
  if (!rec) {
    result = { license_code: null, license_version: null, license_name: null, license_url: null, creator: null, origin_page_url: origin, file_url: null, allowed: false, reason: "file not found on Commons" };
  } else {
    const lic = rec.license;
    let reason = lic.reason;
    let allowed = lic.allowed;
    if (allowed && !rec.creator && lic.code !== "cc0" && lic.code !== "pdm") reason += "; WARNING: no Artist in metadata — attribute via origin page";
    if (!["image/jpeg", "image/png", "image/webp"].includes(rec.mime)) {
      allowed = false;
      reason = `unsupported mime ${rec.mime}`;
    }
    result = {
      license_code: lic.code,
      license_version: lic.version,
      license_name: rec.license_short_name || null,
      license_url: rec.license_url || licenseUrlFor(lic.code, lic.version),
      creator: rec.creator || stripHtml(rec.credit) || null,
      origin_page_url: rec.origin_page_url,
      file_url: rec.file_url,
      file_width: rec.width,
      file_height: rec.height,
      original_width: rec.original_width,
      original_height: rec.original_height,
      title: rec.title,
      allowed,
      reason,
    };
  }
} else {
  const u = new URL(origin);
  if (!/(^|\.)flickr\.com$/.test(u.host) && u.host !== "flic.kr") die(`not a Flickr URL: ${origin}`);
  const params = new URLSearchParams({ format: "json", url: origin, maxwidth: "1024", maxheight: "1024" });
  const res = await request(`https://www.flickr.com/services/oembed/?${params}`, { accept: "application/json", allowStatus: [401, 403, 404] });
  if (res.status !== 200) {
    console.log(JSON.stringify({ license_code: null, license_version: null, license_name: null, license_url: null, creator: null, origin_page_url: origin, file_url: null, allowed: false, reason: `Flickr oEmbed HTTP ${res.status}: photo deleted, private or restricted at origin — license cannot be verified, reject` }, null, 2));
    process.exit(3);
  }
  const o = JSON.parse(res.body.toString("utf8"));
  const lic = classifyLicense({ shortName: o.license, url: o.license_url });
  let allowed = lic.allowed;
  let reason = lic.reason;
  if (o.type && o.type !== "photo") {
    allowed = false;
    reason = `oEmbed type ${o.type}`;
  }
  const file_url = o.url ? flickrSized(o.url, "b") || o.url : null;
  result = {
    license_code: lic.code,
    license_version: lic.version,
    license_name: o.license || null,
    license_url: o.license_url || licenseUrlFor(lic.code, lic.version),
    creator: stripHtml(o.author_name) || null,
    creator_url: o.author_url || null,
    origin_page_url: o.web_page || origin,
    file_url,
    oembed_width: o.width ? Number(o.width) : null,
    oembed_height: o.height ? Number(o.height) : null,
    title: stripHtml(o.title),
    allowed,
    reason,
  };
}
console.log(JSON.stringify(result, null, 2));
process.exit(result.allowed ? 0 : 3);
