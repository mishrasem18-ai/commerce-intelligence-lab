/**
 * Post-build guard: the Cloudflare Worker bundle must not contain `sharp`
 * (a native, build-time-only image library — scripts/build-product-images.mjs).
 *
 * Fails if, anywhere in the OpenNext output (outside the static assets):
 *  - a `sharp` or `@img/*` package directory was traced into node_modules, or
 *  - bundled code contains sharp's native-binding loader ("@img/sharp-").
 * Next's own image optimizer keeps a lazy, optional require('sharp') that is
 * never reached (the app uses plain <img>, not next/image) — that reference
 * alone does not ship the library and is not flagged.
 *
 *   node scripts/check-worker-bundle.mjs   (after `opennextjs-cloudflare build`)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, ".open-next");
if (!existsSync(OUT)) {
  console.error("No .open-next output — run `npx opennextjs-cloudflare build` first.");
  process.exit(1);
}

const problems = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (path === join(OUT, "assets") || path === join(OUT, "cache")) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (dir.endsWith("node_modules") && (name === "sharp" || name === "@img")) {
        problems.push(`package traced into the bundle: ${relative(root, path)}`);
        continue;
      }
      walk(path);
    } else if (/\.(c|m)?js$/.test(name) && stat.size < 64 * 1024 * 1024) {
      if (readFileSync(path, "utf8").includes("@img/sharp-")) {
        problems.push(`sharp native loader bundled in ${relative(root, path)}`);
      }
    }
  }
};
walk(OUT);

if (problems.length > 0) {
  console.error(`✗ sharp found in the Worker bundle:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("✓ Worker bundle is free of sharp");
