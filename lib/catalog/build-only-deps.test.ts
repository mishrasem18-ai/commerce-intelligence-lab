/**
 * sharp is a build-time-only dependency (scripts/build-product-images.mjs).
 * Nothing that can ship to the Cloudflare Worker or the browser may import it.
 * (`npm run check:worker` additionally inspects the built bundle.)
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const RUNTIME_DIRS = ["app", "components", "lib"];
const RUNTIME_FILES = ["middleware.ts", "instrumentation-client.ts", "next.config.ts", "open-next.config.ts"];
const SHARP_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:sharp|@img\/[^"']+)["']/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

test("no runtime source imports sharp", () => {
  const files = [
    ...RUNTIME_DIRS.flatMap((d) => sources(join(ROOT, d))),
    ...RUNTIME_FILES.map((f) => join(ROOT, f)).filter(existsSync),
  ];
  assert.ok(files.length > 50, "scanned the runtime sources");
  const offenders = files
    .filter((f) => !/\.test\.ts$/.test(f))
    .filter((f) => SHARP_IMPORT.test(readFileSync(f, "utf8")))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(offenders, []);
});

test("sharp is a devDependency, never a runtime dependency", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.dependencies?.sharp, undefined);
  assert.ok(pkg.devDependencies?.sharp);
});
