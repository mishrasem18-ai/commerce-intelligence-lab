// In-memory fake of the tiny D1 surface used by lib/db + lib/auth.
// It faithfully implements the specific prepared statements those modules
// issue (matched by SQL fragment), so tests exercise the REAL query/bind code
// — including the UNIQUE-email guard and the session↔user JOIN that guarantees
// a session's user still exists in D1.
export function createFakeD1() {
  const users = new Map(); // id -> row
  const admins = new Map(); // id -> row
  const sessions = new Map(); // id -> row
  const orders = []; // rows of `orders`
  const orderItems = []; // rows of `order_items`

  /** A `users` row with the columns the INSERT above leaves to their defaults. */
  const customerRow = (u) => ({
    country: null,
    country_code: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...u,
  });

  const nowGate = (expiresAt, gate) => expiresAt > gate; // ISO-8601 UTC compares lexicographically

  class Stmt {
    constructor(sql) {
      this.sql = sql;
      this.args = [];
    }
    bind(...values) {
      this.args = values;
      return this;
    }
    async run() {
      const sql = this.sql;
      if (sql.includes("INSERT INTO users")) {
        const [id, email, password_hash, name, first_name, last_name, mobile] = this.args;
        for (const u of users.values()) {
          if (u.email === email) throw new Error("UNIQUE constraint failed: users.email");
        }
        users.set(id, {
          id, email, password_hash, name, first_name, last_name, mobile,
          status: "New", orders_count: 0, spent_cents: 0, last_order_at: null,
        });
        return { success: true };
      }
      if (sql.includes("UPDATE users SET orders_count")) {
        const [amountCents, dateISO, userId] = this.args;
        const u = users.get(userId);
        if (u) {
          u.orders_count += 1;
          u.spent_cents += amountCents;
          u.last_order_at = dateISO;
          if (u.status === "New") u.status = "Active";
        }
        return { success: true };
      }
      if (sql.includes("INSERT INTO sessions")) {
        // buyer: (id, kind, user_id, expires_at); admin: (id, kind, admin_user_id, expires_at)
        const isBuyer = sql.includes("'buyer'");
        const [id, subjectId, expires_at] = this.args;
        sessions.set(id, {
          id, kind: isBuyer ? "buyer" : "admin",
          user_id: isBuyer ? subjectId : null,
          admin_user_id: isBuyer ? null : subjectId,
          expires_at,
        });
        return { success: true };
      }
      if (sql.includes("DELETE FROM sessions")) {
        sessions.delete(this.args[0]);
        return { success: true };
      }
      throw new Error(`fake-d1: unhandled run() SQL: ${sql}`);
    }
    async first() {
      const sql = this.sql;
      if (sql.includes("FROM users WHERE email = ?")) {
        const email = this.args[0];
        for (const u of users.values()) {
          if (u.email === email) {
            return { id: u.id, email: u.email, name: u.name, password_hash: u.password_hash };
          }
        }
        return null;
      }
      if (sql.includes("SELECT * FROM users WHERE id = ?")) {
        // Full customer profile row (lib/db/customers.ts#getCustomerById).
        const u = users.get(this.args[0]);
        return u ? customerRow(u) : null;
      }
      if (sql.includes("SELECT * FROM orders WHERE order_number = ?")) {
        return orders.find((o) => o.order_number === this.args[0]) ?? null;
      }
      if (sql.includes("FROM sessions s JOIN admin_users a")) {
        const [id, gate] = this.args;
        const s = sessions.get(id);
        if (!s || s.kind !== "admin" || !nowGate(s.expires_at, gate)) return null;
        const a = admins.get(s.admin_user_id); // JOIN: admin must still exist
        if (!a) return null;
        return { aid: a.id, email: a.email, name: a.name };
      }
      if (sql.includes("FROM sessions s JOIN users u")) {
        const [id, gate] = this.args;
        const s = sessions.get(id);
        if (!s || s.kind !== "buyer" || !nowGate(s.expires_at, gate)) return null;
        const u = users.get(s.user_id); // JOIN: user must still exist
        if (!u) return null;
        return { uid: u.id, email: u.email, name: u.name };
      }
      throw new Error(`fake-d1: unhandled first() SQL: ${sql}`);
    }
    async all() {
      const sql = this.sql;
      if (sql.includes("SELECT * FROM users ORDER BY")) {
        return { results: [...users.values()].map(customerRow), success: true };
      }
      if (sql.includes("SELECT * FROM orders ORDER BY")) {
        return { results: [...orders], success: true };
      }
      if (sql.includes("SELECT * FROM order_items WHERE order_id = ?")) {
        return { results: orderItems.filter((i) => i.order_id === this.args[0]), success: true };
      }
      if (sql.includes("SELECT * FROM order_items")) {
        return { results: [...orderItems], success: true };
      }
      return { results: [], success: true };
    }
  }

  return {
    prepare(sql) {
      return new Stmt(sql);
    },
    async batch(statements) {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
    // Test helpers (not part of the D1 surface).
    _users: users,
    _admins: admins,
    _sessions: sessions,
    /** Insert an order (and one line item) the way a completed checkout leaves it. */
    _addOrder({ orderNumber, userId, email, name = "Test Buyer", shipLine1 = null, shipMobile = null }) {
      const id = `#${orderNumber}`;
      orders.push({
        id, order_number: orderNumber, user_id: userId, customer_name: name, email,
        country: "India", country_code: "IN", status: "Processing",
        payment_method: "COD", payment_status: "Pending",
        subtotal_cents: 1000, tax_cents: 80, shipping_cents: 999, total_cents: 2079,
        ship_full_name: name, ship_mobile: shipMobile, ship_line1: shipLine1, ship_line2: null,
        ship_city: "Pune", ship_state: "MH", ship_postal_code: "411001", ship_country: "India",
        placed_at: "2026-10-01T00:00:00.000Z", created_at: "2026-10-01T00:00:00.000Z",
      });
      orderItems.push({
        order_id: id, product_id: "prod-1000", product_name: "Test Product", sku: "TST-1000",
        unit_price_cents: 1000, quantity: 1,
      });
      return id;
    },
    _expireAllSessions() {
      for (const s of sessions.values()) s.expires_at = "2000-01-01T00:00:00.000Z";
    },
  };
}
