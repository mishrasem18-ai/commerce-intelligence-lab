/**
 * Who may import the code that reads other people's customer and order data.
 *
 * Until this guard existed, the root layout loaded every customer and every
 * order and passed them to client stores, so each page's HTML carried the
 * full lists for any visitor. Three rules keep that from coming back:
 *
 *  1. The unscoped D1 readers are imported only by `lib/db/admin-data.ts`,
 *     which checks the admin session inside each read. `getCustomerById` is
 *     also allowed in the buyer auth routes, which pass it the id of the
 *     session they just validated (the buyer's own profile).
 *  2. The client stores holding the full lists are imported only by the admin
 *     layout that seeds them and by admin components.
 *  3. The root layout, which renders for every visitor, reads nothing from D1
 *     but the catalog.
 *
 * Run: npm run test:auth
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;

/** Named imports of `specifier` in `source`, e.g. ["getOrders", "createOrder"]. */
export function namedImports(source: string, specifier: string): string[] {
  const names: string[] = [];
  const pattern = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    if (match[2] !== specifier) continue;
    for (const part of match[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

/** True when `source` imports anything at all from `specifier`. */
export function importsFrom(source: string, specifier: string): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`(?:from|import)\\s*\\(?\\s*["']${escaped}["']`).test(source);
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = ["app", "components", "lib"]
  .flatMap((dir) => sourceFiles(join(ROOT, dir)))
  .map((file) => ({ rel: relative(ROOT, file), source: readFileSync(file, "utf8") }));

const ADMIN_DATA = "lib/db/admin-data.ts";

/** Readers that return records without checking whose they are → who may import them. */
const UNSCOPED_READERS: [specifier: string, name: string, allowed: (rel: string) => boolean][] = [
  ["@/lib/db/orders", "getOrders", (rel) => rel === ADMIN_DATA],
  ["@/lib/db/orders", "getOrderById", (rel) => rel === ADMIN_DATA],
  ["@/lib/db/orders", "getOrderByNumber", (rel) => rel === ADMIN_DATA],
  ["@/lib/db/customers", "getCustomers", (rel) => rel === ADMIN_DATA],
  [
    "@/lib/db/customers",
    "getCustomerById",
    (rel) => rel === ADMIN_DATA || /^app\/api\/auth\/(session|login|register)\/route\.ts$/.test(rel),
  ],
];

test("unscoped order and customer readers are imported only by the admin data module", () => {
  const offenders: string[] = [];
  for (const { rel, source } of FILES) {
    for (const [specifier, name, allowed] of UNSCOPED_READERS) {
      if (namedImports(source, specifier).includes(name) && !allowed(rel)) {
        offenders.push(`${rel} imports ${name}`);
      }
    }
    // A namespace or default import would bypass the per-name rule.
    for (const specifier of ["@/lib/db/orders", "@/lib/db/customers"]) {
      if (new RegExp(`import\\s+(?:\\*\\s+as\\s+)?\\w+\\s+from\\s+["']${specifier}["']`).test(source)) {
        offenders.push(`${rel} imports all of ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders.sort(), []);
});

/** Directories whose components only render inside the admin layout. */
const ADMIN_COMPONENT_DIRS = ["ai", "customers", "dashboard", "layout", "orders", "tables"];
const mayUseAdminStores = (rel: string) =>
  rel.startsWith("app/admin/(protected)/") ||
  ADMIN_COMPONENT_DIRS.some((dir) => rel.startsWith(`components/${dir}/`));

test("the stores holding every order and customer are imported only by admin code", () => {
  const offenders: string[] = [];
  for (const { rel, source } of FILES) {
    for (const store of ["@/lib/store/orders-store", "@/lib/store/customers-store"]) {
      if (importsFrom(source, store) && !mayUseAdminStores(rel)) offenders.push(`${rel} imports ${store}`);
    }
  }
  assert.deepEqual(offenders.sort(), []);
});

test("the root layout and its providers read nothing from D1 but the catalog", () => {
  for (const rel of ["app/layout.tsx", "components/providers.tsx"]) {
    const file = FILES.find((f) => f.rel === rel);
    assert.ok(file, `${rel} exists`);
    const dbImports = [...file.source.matchAll(/from\s+["'](@\/lib\/db\/[^"']+)["']/g)].map((m) => m[1]);
    assert.deepEqual(
      dbImports.filter((specifier) => specifier !== "@/lib/db/products"),
      [],
      `${rel} must not read customer or order data: it renders for every visitor`,
    );
    assert.ok(!importsFrom(file.source, "@/lib/db/admin-data"), `${rel} must not import admin data`);
  }
});

test("the scan itself recognises the import shapes it guards against", () => {
  assert.deepEqual(
    namedImports('import { createOrder, getOrders } from "@/lib/db/orders";', "@/lib/db/orders"),
    ["createOrder", "getOrders"],
  );
  assert.deepEqual(
    namedImports('import {\n  getCustomers as all,\n  type Row,\n} from "@/lib/db/customers";', "@/lib/db/customers"),
    ["getCustomers", "Row"],
  );
  assert.deepEqual(namedImports('import { getOrders } from "@/lib/db/orders-archive";', "@/lib/db/orders"), []);
  assert.ok(importsFrom('import { useOrders } from "@/lib/store/orders-store";', "@/lib/store/orders-store"));
  assert.ok(importsFrom('const m = await import("@/lib/store/orders-store");', "@/lib/store/orders-store"));
  assert.equal(importsFrom('import { x } from "@/lib/store/orders-store-utils";', "@/lib/store/orders-store"), false);
});
