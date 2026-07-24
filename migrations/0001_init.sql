-- Migration 0001 — initial commerce schema for Cloudflare D1.
--
-- Phase A: schema only. The running application still reads/writes localStorage;
-- nothing in the app talks to D1 yet. This migration is safe to apply to an
-- empty database and is purely additive.
--
-- Conventions:
--   * TEXT primary keys (preserve existing demo ids for later seeding).
--   * Money stored as INTEGER cents (avoids floating-point drift).
--   * Timestamps as TEXT ISO-8601 via datetime('now').
--   * order_items snapshot product_name / sku / unit_price_cents so historical
--     orders stay correct even if the product is renamed, repriced, or deleted.

PRAGMA foreign_keys = ON;

-- Buyers ARE customers. password_hash NULL => seed/demo customer that the admin
-- can see but that cannot log in (no registered credentials).
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,            -- stored lowercased
  password_hash TEXT,                            -- PBKDF2 "salt:iterations:hash"; NULL for seed customers
  name          TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  mobile        TEXT,
  country       TEXT,
  country_code  TEXT,
  status        TEXT NOT NULL DEFAULT 'New',     -- New | Active | At Risk | VIP
  orders_count  INTEGER NOT NULL DEFAULT 0,      -- denormalized metric
  spent_cents   INTEGER NOT NULL DEFAULT 0,
  last_order_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_status ON users(status);

-- Admin operators (separate from buyers). Credentials are hashed, never plaintext.
CREATE TABLE admin_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,                   -- slug
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  sku           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  category_id   TEXT NOT NULL REFERENCES categories(id),
  brand         TEXT,
  price_cents   INTEGER NOT NULL,
  cost_cents    INTEGER NOT NULL DEFAULT 0,
  inventory     INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),  -- guards against oversell
  status        TEXT NOT NULL DEFAULT 'Active',  -- Active | Draft | Archived
  rating        REAL,
  image         TEXT,
  units_sold    INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status_inventory ON products(status, inventory);  -- low-stock lookups

CREATE TABLE addresses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name   TEXT,
  mobile      TEXT,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT,
  state       TEXT,
  postal_code TEXT,
  country     TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,        -- boolean 0/1
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE orders (
  id             TEXT PRIMARY KEY,
  order_number   TEXT NOT NULL UNIQUE,           -- e.g. ORD-RYT4I1X
  user_id        TEXT REFERENCES users(id),      -- nullable: keep order history if user is removed
  customer_name  TEXT NOT NULL,                  -- snapshot
  email          TEXT NOT NULL,                  -- snapshot
  country        TEXT,
  country_code   TEXT,
  status         TEXT NOT NULL DEFAULT 'Processing', -- Processing|Paid|Pending|Shipped|Refunded|Cancelled
  payment_method TEXT NOT NULL DEFAULT 'COD',    -- Card | COD
  payment_status TEXT NOT NULL DEFAULT 'Pending',-- Paid | Pending | Refunded
  subtotal_cents INTEGER NOT NULL,
  tax_cents      INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL,
  -- Shipping address SNAPSHOT (kept even if the saved address changes/deletes).
  ship_full_name   TEXT,
  ship_mobile      TEXT,
  ship_line1       TEXT,
  ship_line2       TEXT,
  ship_city        TEXT,
  ship_state       TEXT,
  ship_postal_code TEXT,
  ship_country     TEXT,
  placed_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_placed_at ON orders(placed_at);

CREATE TABLE order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       TEXT REFERENCES products(id) ON DELETE SET NULL,  -- keep line if product deleted
  product_name     TEXT NOT NULL,                -- SNAPSHOT — survives later rename
  sku              TEXT NOT NULL,                -- SNAPSHOT
  unit_price_cents INTEGER NOT NULL,             -- SNAPSHOT — survives later price change
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Server-validated sessions. id = SHA-256 hash of the opaque cookie token
-- (store the hash, never the raw token). Exactly one of user_id / admin_user_id
-- is set, matching `kind`.
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,                   -- 'buyer' | 'admin'
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  admin_user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_admin_user ON sessions(admin_user_id);
