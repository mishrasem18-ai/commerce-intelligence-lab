# Product image sourcing tools

One real, license-verified photo per product-type noun, self-hosted (never hotlinked).
Node 22 ESM, only dependency is `sharp` (devDependency). Run everything from the repo root.

**All network access goes through these scripts.** `lib/net.mjs` enforces the User-Agent,
a global cross-process lock per host (one request at a time across all processes), minimum
intervals per host (Openverse 3.5 s, commons.wikimedia.org / www.flickr.com 1 s, image
hosts 0.4 s), retries on 429/5xx (max 3, honours Retry-After) and the Openverse budget.
Never curl the APIs yourself and never scrape HTML.

Scratch root (`$IMG` below): `$IMAGES_SCRATCH`, default `<os tmpdir>/cil-product-images`
(candidate previews, grids, locks and request state; never committed).
Slug = `noun.toLowerCase().replace(/[^a-z0-9]+/g,"-")` trimmed ("Ceramic Vase" → `ceramic-vase`).

## 1. Search: `search.mjs`

```sh
node scripts/images/search.mjs --noun "Ceramic Vase" --query "ceramic vase white background" [--provider auto|openverse|commons] [--limit 20]
```

- `commons` (recommended default for most nouns): MediaWiki `generator=search` over File: pages
  with `filetype:bitmap filew:>799 fileh:>799 <query>`; `--limit` up to 50.
- `openverse`: Openverse restricted to `source=wikimedia,flickr`, allowed licenses, photographs,
  page size ≤ 20. Wikimedia hits are re-read from the Commons API (authoritative size/license).
- `auto` (default): Openverse if the budget allows for this noun, else Commons.
  Openverse is refused (and the script silently falls back to Commons) when the noun already used
  2 Openverse queries, or the header-reported daily budget is below 12.
- Keeps only CC0 / PDM(public domain) / CC BY / CC BY-SA, jpeg/png/webp, and sources whose
  downloadable file has min side ≥ 800 (Flickr: at the `_b` 1024px size, so only near-square
  Flickr photos survive).
- Appends new candidates (dedupe by origin page) to `$IMG/candidates/<slug>/candidates.json`, downloads
  previews (`prev-<id>.jpg`) and re-renders `grid.jpg` (or `grid-1.jpg`, `grid-2.jpg`… when > 30).
  Each tile: big yellow id top-left, bottom strip `W|F <file WxH> <license>` (W = Wikimedia, F = Flickr).
- stdout: noun/slug/provider line, counts, dropped reasons, grid path(s), and a table
  `id new src WxH license title` (`+` marks candidates added by this run).

candidates.json entry:
```json
{"id":2,"provider":"wikimedia","title":"Aged ceramic white vase.jpg",
 "origin_page_url":"https://commons.wikimedia.org/wiki/File:Aged_ceramic_white_vase.jpg",
 "file_url":"https://thumb.wikimedia.org/.../1920px-Aged_ceramic_white_vase.jpg","preview_url":"...500px-...",
 "width":1920,"height":2402,"original_width":4912,"original_height":6144,
 "license_hint":"by-sa 4.0","creator_hint":"Karl Thomas Moore","query":"...","searched_via":"commons"}
```
`width/height` are those of `file_url` (Commons: 1920px-wide standard thumb when the original is wider,
3840 if needed to keep the short side ≥ 800, else the original; Flickr: `_b`). Hints are NOT
verification — always run `verify-license.mjs` on the final pick.

## 2. Inspect / crop: `crop.mjs`

```sh
node scripts/images/crop.mjs --noun "Ceramic Vase" --candidate 2                      # overview
node scripts/images/crop.mjs --noun "Ceramic Vase" --candidate 2 --crop 160,800,1600   # left,top,size in file px
node scripts/images/crop.mjs --noun "Ceramic Vase" --candidate 2 --focus 0.5,0.7,0.9   # centre fx,fy (0..1), size = fraction*min(W,H)
```

- Downloads `file_url` once to `assets/product-source/<slug>.<ext>` (+ `<slug>.source.json` sidecar).
  Switching candidates replaces that file (per-candidate copies are cached as `$IMG/candidates/<slug>/src-<id>.<ext>`).
- Overview mode writes `full-<id>.jpg` (≤1200px long edge) and `full-<id>-coords.jpg` (same, with
  magenta gridlines labelled in FILE pixels) and prints the largest possible square.
- Crop mode validates size ≥ 800 and in-bounds (`--focus` clamps into bounds), writes
  `crop-<id>.jpg` at 800×800, exits 2 on invalid crops. Coordinates are in EXIF-oriented pixel space.
- Last stdout line is JSON:
  `{"candidate":2,"crop":{"left":160,"top":800,"size":1600},"source_file":"assets/product-source/ceramic-vase.jpg","file_url":"...","file_width":1920,"file_height":2402}`
- View `crop-<id>.jpg` with the Read tool and check every hard rule (people/hands, readable logos/text,
  watermarks, borders) on the final crop.

## 3. Verify license at origin: `verify-license.mjs`

```sh
node scripts/images/verify-license.mjs --provider wikimedia --origin "https://commons.wikimedia.org/wiki/File:Foo.jpg"
node scripts/images/verify-license.mjs --provider flickr    --origin "https://www.flickr.com/photos/<user>/<photo-id>"
```

Prints JSON `{license_code (cc0|pdm|by|by-sa|nc|nd|other|null), license_version, license_name, license_url,
creator, origin_page_url, file_url, allowed, reason, ...}`; exit 0 if allowed, 3 if not.
Commons uses `prop=imageinfo&iiprop=extmetadata|url|size`; Flickr uses the keyless oEmbed endpoint.
A Flickr oEmbed 404 (photo deleted/private) → `allowed:false`: reject that candidate.

## 4. Reproduce sources: `fetch-sources.mjs`

```sh
node scripts/images/fetch-sources.mjs [--force] [--only <slug>] [--manifest data/product-images.json] [--out assets/product-source]
```

Reads `data/product-images.json` (an array, `{"items":[...]}`, or an object keyed by slug). Each entry needs
`slug` (or `noun`), `file_url`, `file_width`, `file_height`; optional `source_file`. Downloads missing
(or changed-URL, or `--force`) files into `assets/product-source/` and checks the pixel dimensions equal
the manifest; exit 1 on any failure. Recommended entry shape = crop.mjs JSON + verify-license JSON:
`{noun, slug, provider, origin_page_url, file_url, file_width, file_height, source_file, crop:{left,top,size},
license_code, license_version, license_name, license_url, creator, title}`.

## State & debugging

- `$IMG/.state/openverse.json` — `sustained_available`, `burst_available`, `per_noun{slug:count}`.
- `$IMG/.state/requests.log` — every request: `start -> end pid host status ms url`.
- `$IMG/.state/stamps/<host>.json` — last request time / backoff (`notBefore`).
- `$IMG/.locks/<name>.lock/` — held locks (auto-recovered if older than 60 s or owner pid is dead).
- `IMAGES_NET_QUIET=1` silences the `[net]` stderr lines.
