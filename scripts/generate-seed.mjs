/**
 * Phase B seed generator.
 *
 * Reads the existing static demo data (lib/data/products.ts + lib/data.ts) — the
 * same arrays the app seeds today — and emits migrations/0002_seed.sql so D1 is
 * populated with identical ids / skus / relationships. This keeps a single
 * source of truth: regenerate with `node --experimental-strip-types scripts/generate-seed.mjs`.
 *
 * Money is converted to INTEGER cents. Category names become category rows and
 * products reference them by slug id. Seed customers become `users` rows with a
 * NULL password_hash (visible to admin, cannot log in). Seed orders keep their
 * numbers/dates/status; they carry no line items in the source data, so
 * order_items is intentionally left empty for them (documented below).
 */

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const { products, PRODUCT_CATEGORIES } = await import(
  join(root, "lib/data/products.ts")
);
const { orders, customers } = await import(join(root, "lib/data.ts"));

/* ------------------------------- helpers ------------------------------- */
const cents = (dollars) => Math.round(Number(dollars) * 100);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const q = (v) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const n = (v) => (v === null || v === undefined ? "NULL" : String(v));

function paymentStatusFor(orderStatus) {
  if (orderStatus === "Paid") return "Paid";
  if (orderStatus === "Refunded") return "Refunded";
  return "Pending";
}

// email -> seed customer id, so seed orders link to a user where one exists.
const customerByEmail = new Map(
  customers.map((c) => [c.email.toLowerCase(), c.id]),
);

/* ------------------------------- admin hash ------------------------------- */
// PBKDF2-SHA256 hash of the demo admin password. Format documented for Phase D:
//   pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@commercelab.io").toLowerCase();
// No real password is baked into source. When ADMIN_PASSWORD is unset we seed a
// clearly non-production placeholder (its hash only) so local regen still works;
// set ADMIN_PASSWORD (env / Cloudflare secret) to provision/rotate a real one.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "CHANGE_ME_BEFORE_PRODUCTION";
if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "  [warn] ADMIN_PASSWORD not set — seeding a placeholder admin password hash.",
  );
}
const ITER = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(ADMIN_PASSWORD, salt, ITER, 32, "sha256");
const adminHash = `pbkdf2$sha256$${ITER}$${salt.toString("base64")}$${hash.toString("base64")}`;

/* ------------------------------- build SQL ------------------------------- */
const lines = [];
lines.push("-- Migration 0002 — seed baseline demo commerce data (generated).");
lines.push("-- Source: lib/data/products.ts + lib/data.ts. Do not hand-edit;");
lines.push("-- regenerate via scripts/generate-seed.mjs. Phase B: local only.");
lines.push("");
lines.push("PRAGMA foreign_keys = ON;");
lines.push("");

// Categories
lines.push(`-- Categories (${PRODUCT_CATEGORIES.length})`);
for (const name of PRODUCT_CATEGORIES) {
  lines.push(
    `INSERT INTO categories (id, name) VALUES (${q(slug(name))}, ${q(name)});`,
  );
}
lines.push("");

// Products
lines.push(`-- Products (${products.length})`);
for (const p of products) {
  lines.push(
    "INSERT INTO products (id, sku, name, description, category_id, brand, " +
      "price_cents, cost_cents, inventory, status, rating, image, units_sold, " +
      "revenue_cents, created_at, updated_at) VALUES (" +
      [
        q(p.id),
        q(p.sku),
        q(p.name),
        q(p.description),
        q(slug(p.category)),
        q(p.brand),
        n(cents(p.price)),
        n(cents(p.cost)),
        n(p.inventory),
        q(p.status),
        n(p.rating),
        q(p.image),
        n(p.unitsSold),
        n(cents(p.revenue)),
        q(p.createdAt),
        q(p.updatedAt),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// Admin user
lines.push("-- Admin operator. The password is supplied via the ADMIN_PASSWORD env/secret");
lines.push("-- at seed time (demo default when unset); only its PBKDF2-SHA256 hash is stored.");
lines.push(
  `INSERT INTO admin_users (id, email, password_hash, name, role) VALUES (` +
    `'admin-1', ${q(ADMIN_EMAIL)}, ${q(adminHash)}, 'Anurag Mishra', 'admin');`,
);
lines.push("");

// Users (seed customers — no login credentials)
lines.push(`-- Users / customers (${customers.length}; password_hash NULL = seed, cannot log in)`);
for (const c of customers) {
  lines.push(
    "INSERT INTO users (id, email, password_hash, name, country, country_code, " +
      "status, orders_count, spent_cents) VALUES (" +
      [
        q(c.id),
        q(c.email.toLowerCase()),
        "NULL",
        q(c.name),
        q(c.country),
        q(c.countryCode),
        q(c.status),
        n(c.orders),
        n(cents(c.spent)),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// Orders (legacy seed orders: gross amount only; no line items in source data)
lines.push(`-- Orders (${orders.length}). Legacy seed orders store a gross total only`);
lines.push("-- (no line-item breakdown exists in the source), so order_items is");
lines.push("-- intentionally empty for these; new orders will populate it in later phases.");
for (const o of orders) {
  const orderNumber = o.id.replace(/^#/, "");
  const userId = customerByEmail.get(o.email.toLowerCase()) ?? null;
  lines.push(
    "INSERT INTO orders (id, order_number, user_id, customer_name, email, " +
      "country, country_code, status, payment_method, payment_status, " +
      "subtotal_cents, tax_cents, shipping_cents, total_cents, placed_at) VALUES (" +
      [
        q(o.id),
        q(orderNumber),
        q(userId),
        q(o.customer),
        q(o.email),
        q(o.country),
        q(o.countryCode),
        q(o.status),
        "'Card'",
        q(paymentStatusFor(o.status)),
        n(cents(o.amount)),
        "0",
        "0",
        n(cents(o.amount)),
        q(o.date),
      ].join(", ") +
      ");",
  );
}
lines.push("");

const out = join(root, "migrations", "0002_seed.sql");
writeFileSync(out, lines.join("\n") + "\n");
console.log(
  `Wrote ${out}\n` +
    `  categories=${PRODUCT_CATEGORIES.length} products=${products.length} ` +
    `admin_users=1 users=${customers.length} orders=${orders.length} order_items=0`,
);
