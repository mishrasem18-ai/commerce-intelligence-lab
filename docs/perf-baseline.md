# Performance baseline

Lighthouse (mobile, simulated throttling, performance only) and `/api/products` payload
numbers captured **before** any performance work, so later changes can be compared
against them. They were measured against a **local `wrangler dev` preview of the production
OpenNext build**, not the Cloudflare edge. Use the absolute numbers only for before/after
comparison on the same setup.

## Environment

| | |
|---|---|
| Date | 2026-09-26 |
| Commit | `44aa4eb` |
| Build / serve | `npx opennextjs-cloudflare build` + `npx opennextjs-cloudflare preview` (wrangler 4.113.0, local D1 with 120 seeded products) at `http://localhost:8787` |
| Stack | Next 16.2.11, @opennextjs/cloudflare 1.20.2, Node 22.18.0 |
| Lighthouse | 12.8.2 (`npx -y lighthouse@12`), default mobile form factor + simulated throttling, `--only-categories=performance` |
| Chrome | Google Chrome 153.0.8010.54, `--headless=new` |
| Machine | Apple M3, 8 GB, macOS 26.6.2 |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` set in `.env.local` | yes (GTM is loaded on every page) |

## Lighthouse (median of 3 runs, by performance score)

| Page | Score | LCP (ms) | CLS | TBT (ms) | FCP (ms) | Total KB | LCP element |
|---|---|---|---|---|---|---|---|
| `/` | 83 | 4297 | 0 | 63 | 2271 | 872 | Hero `<h1>` "Tech, style & essentials — all in one place." |
| `/shop` | 79 | 4890 | 0 | 53 | 2416 | 894 | Product card `<img>` (SVG `data:` URI), "Oakcraft Writing Desk S3" |
| `/product/prod-1000` | 66 | 4368 | 0.343 | 46 | 2114 | 834 | Consent banner `<p>` "Your privacy choices…" |
| `/admin/products` | 77 | 4890 | 0 | 82 | 2868 | 1003 | Page subtitle `<p>` "Manage your catalog, track performance and monitor inventory." |

Per-run scores: `/` 71 / 83 / 84, `/shop` 73 / 79 / 80, `/product/prod-1000` 65 / 66 / 67,
`/admin/products` 75 / 77 / 77.

Notes:

- **Noise:** the first run of `/` and `/shop` had LCP near 7.4 s, compared with 4.1–4.9 s on later runs. Always compare medians.
- **Admin audit:** the admin page was audited with a real `cil_admin` session cookie, and the audited final URL was `/admin/products` in all 3 runs, not the login page.
- **Compression:** the local preview serves everything uncompressed (`Content-Encoding: identity`). The HTML document alone is 253–404 KB (it inlines 124–143 SVG `data:` URIs from the catalog). Script is about 480–510 KB, of which about 295 KB is GTM (`gtm.js` + `gtag/js`). Fonts are 52 KB and CSS is 14 KB.
- **CLS on `/product/prod-1000`:** 0.343 in all 3 runs, and the element that shifts is the site footer. No other page shifts.

## `/api/products` payload

| Measure | Bytes |
|---|---|
| Products | 120 (all `image` values are SVG `data:` URIs) |
| Raw body | 179,503 B (175.3 KB) |
| As served with `Accept-Encoding: gzip, br` (local preview) | 179,503 B, uncompressed (`Content-Encoding: identity`) |
| Body gzip / brotli (computed, Node zlib defaults) | 14,627 B / 9,324 B |
| `image` fields (serialized `"image":"…",`) | 132,536 B (129.4 KB), **73.8 % of raw**, about 1.1 KB per product |
| Body without `image` fields: raw / gzip / brotli | 46,967 B / 8,721 B / 6,746 B |

## How to re-run

Terminal 1 (repo root) starts the production preview:

```bash
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview          # serves http://localhost:8787
# If the local D1 has no tables (LOCAL only, never --remote):
# npx wrangler d1 migrations apply commerce-intelligence-lab-db --local
```

If the build fails with "You installed workerd on another platform", the native binary is
missing from `node_modules/@cloudflare/workerd-darwin-arm64/bin/`. Reinstall dependencies with `npm ci`.

Terminal 2 (repo root) runs the measurements. It reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local` and never prints them:

```bash
OUT=${OUT:-/tmp/cil-perf}; BASE=${BASE:-http://localhost:8787}; RUNS=${RUNS:-3}
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$OUT/lh"

cat > "$OUT/login.mjs" <<'EOF'
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => /^[A-Z0-9_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
const res = await fetch(`${process.argv[2]}/api/admin/login`, { method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
const c = res.headers.getSetCookie().map((s) => s.split(";")[0]).find((s) => s.startsWith("cil_admin="));
if (!c) { console.error(`admin login failed: HTTP ${res.status}`); process.exit(1); }
process.stdout.write(c);
EOF

cat > "$OUT/summarize.mjs" <<'EOF'
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2], groups = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const r = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")), a = r.audits;
  const el = a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node;
  const row = { page: new URL(r.requestedUrl).pathname, final: new URL(r.finalDisplayedUrl).pathname,
    score: Math.round(r.categories.performance.score * 100),
    lcp: Math.round(a["largest-contentful-paint"].numericValue),
    cls: +a["cumulative-layout-shift"].numericValue.toFixed(3),
    tbt: Math.round(a["total-blocking-time"].numericValue),
    fcp: Math.round(a["first-contentful-paint"].numericValue),
    kb: Math.round(a["total-byte-weight"].numericValue / 1024),
    el: el ? `${el.nodeLabel} <${(el.snippet ?? "").slice(0, 60)}>` : "n/a" };
  console.log(`${f}\tfinal=${row.final}\tscore=${row.score} lcp=${row.lcp} cls=${row.cls} tbt=${row.tbt} fcp=${row.fcp} kb=${row.kb}`);
  (groups[row.page] ??= []).push(row);
}
console.log("\n| Page | Score | LCP (ms) | CLS | TBT (ms) | FCP (ms) | Total KB | LCP element |\n|---|---|---|---|---|---|---|---|");
for (const [page, rows] of Object.entries(groups)) {
  const m = [...rows].sort((x, y) => x.score - y.score)[Math.floor(rows.length / 2)];
  console.log(`| \`${page}\` | ${m.score} | ${m.lcp} | ${m.cls} | ${m.tbt} | ${m.fcp} | ${m.kb} | ${m.el.replace(/\|/g, "\\|")} |`);
}
EOF

cat > "$OUT/api-size.mjs" <<'EOF'
import { gzipSync, brotliCompressSync } from "node:zlib";
const buf = Buffer.from(await (await fetch(`${process.argv[2]}/api/products`,
  { headers: { "accept-encoding": "identity" } })).arrayBuffer());
const { products } = JSON.parse(buf.toString("utf8"));
const img = products.reduce((n, p) => n + (p.image == null ? 0 : Buffer.byteLength(JSON.stringify(p.image)) + '"image":,'.length), 0);
const noImg = JSON.stringify({ products: products.map(({ image, ...rest }) => rest) });
console.log({ products: products.length, dataUriImages: products.filter((p) => p.image?.startsWith("data:")).length,
  raw: buf.length, gzip: gzipSync(buf).length, brotli: brotliCompressSync(buf).length,
  imageFieldBytes: img, imagePct: +(100 * img / buf.length).toFixed(1),
  withoutImages: { raw: Buffer.byteLength(noImg), gzip: gzipSync(noImg).length, brotli: brotliCompressSync(noImg).length } });
EOF

COOKIE=$(node "$OUT/login.mjs" "$BASE") || exit 1
for page in / /shop /product/prod-1000 /admin/products; do
  slug=$(echo "$page" | sed 's#^/##; s#/#_#g'); slug=${slug:-home}
  extra=(); [[ $page == /admin/* ]] && extra=(--extra-headers "{\"Cookie\":\"$COOKIE\"}")
  curl -s -o /dev/null -H "Cookie: $COOKIE" "$BASE$page"        # warm the route
  for i in $(seq 1 "$RUNS"); do
    npx -y lighthouse@12 "$BASE$page" --quiet --only-categories=performance \
      --output=json --output-path="$OUT/lh/$slug-$i.json" \
      --chrome-flags="--headless=new --no-first-run --no-default-browser-check" ${extra[@]+"${extra[@]}"}
  done
done
node "$OUT/summarize.mjs" "$OUT/lh"        # check final= is /admin/products, not /admin/login
node "$OUT/api-size.mjs" "$BASE"
for enc in identity "gzip, br"; do         # bytes actually served
  curl -s -o /dev/null -H "Accept-Encoding: $enc" -w "api/products [$enc]: %{size_download} B\n" "$BASE/api/products"
done
```

## After: page titles, search, and real product images (2026-09-27)

Measured with the runner above, unchanged: same machine, local `opennextjs-cloudflare preview`
at `http://localhost:8787`, GTM on, Lighthouse 12.8.2, headless Chrome 153, mobile with
simulated throttling, performance only, median of 3 runs chosen by score. The baseline
column repeats the table above (commit `44aa4eb`). The after column was measured on the
tree that shipped the 95 built product images (`public/products/`).

| Page | Score | LCP (ms) | CLS | TBT (ms) | FCP (ms) | Total KB | LCP element (after) |
|---|---|---|---|---|---|---|---|
| `/` | 83 → **87** | 4297 → **3914** | 0 → **0** | 63 → **53** | 2271 → 1665 | 872 → 874 | Hero `<h1>` |
| `/shop` | 79 → **85** | 4890 → **4287** | 0 → **0** | 53 → **32** | 2416 → 1669 | 894 → 917 | Product card `<img>` (`/products/writing-desk.…`) |
| `/product/prod-1000` | 66 → **90** | 4368 → **3551** | 0.343 → **0** | 46 → **47** | 2114 → 1365 | 834 → 689 | Consent banner `<p>` |
| `/admin/products` | 77 → **82** | 4890 → **4506** | 0 → **0** | 82 → **74** | 2868 → 2115 | 1003 → 1012 | Page subtitle `<p>` |

Per-run TBT / LCP (ms), before → after:
`/` 28/7439, 63/4297, 48/4124 → 46/3919, 53/3914, 65/3994;
`/shop` 30/7478, 53/4890, 53/4792 → 36/4579, 56/4142, 32/4287;
`/product/prod-1000` 51/4547, 46/4368, 40/4218 → 41/3694, 47/3551, 47/3541;
`/admin/products` 58/5356, 82/4890, 79/4780 → 57/4506, 74/4506, 46/4505.

- **LCP and CLS are equal or better on all four pages; CLS is 0 everywhere.** The PDP
  footer shift (0.343) is gone.
- **TBT is better on `/`, `/shop` and `/admin/products`. On `/product/prod-1000` the median
  is 1 ms worse (47 vs 46).** That is inside the run-to-run spread (40–51 ms before, 41–47 ms
  after), and the mean fell from 45.7 to 45.0 ms. It is still a strict miss against "equal or
  better", so it is reported here as one.
- `prod-1000` is an **Archived** product, so the PDP renders its unavailable state and no
  product photo. That makes before and after like for like, but it does not exercise the image
  path. For information only (no baseline), an active PDP, `/product/prod-1095` (Facial
  Roller), scored 90 with LCP 3605 ms, CLS 0 and TBT 45 ms. Its LCP element is the product
  `<img>` (eager, `fetchpriority="high"`), and it loaded 4 image requests totalling 44.9 KB.
- Total KB rises slightly on `/shop` and `/admin/products` because they now download real
  photos (163.5 KB and 147.5 KB of images). This is offset by much smaller HTML.

### HTML document and `/api/products` size

HTML is the main document's decoded size from the Lighthouse network log (identical in all
runs). The local preview serves it uncompressed.

| Resource | Before | After | Change |
|---|---|---|---|
| `/` HTML | 301.4 KB | 162.3 KB | −46 % |
| `/shop` HTML | 325.9 KB | 179.8 KB | −45 % |
| `/product/prod-1000` HTML | 252.6 KB | 102.9 KB | −59 % |
| `/admin/products` HTML | 403.0 KB | 259.0 KB | −36 % |
| `/api/products` raw body | 179,503 B | 49,829 B | −72 % |
| `/api/products` gzip / brotli (computed) | 14,627 / 9,324 B | 9,416 / 7,251 B | −36 % / −22 % |
| `image` fields in `/api/products` | 132,536 B (73.8 %) | 2,862 B (5.7 %) | −98 % |

The drop comes from replacing each product's inline SVG `data:` URI with a short image key.
The `<picture>` element builds its URLs from that key and the build-time asset map.

### Caching

`curl -I http://localhost:8787/products/<key>.<hash>-640.webp` returns
`Cache-Control: public, max-age=31536000, immutable` (`public/_headers`). HTML stays
`private, no-cache, no-store`.
