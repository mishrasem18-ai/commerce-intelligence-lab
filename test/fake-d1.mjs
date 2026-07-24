// In-memory fake of the tiny D1 surface used by lib/db + lib/auth.
// It faithfully implements the specific prepared statements those modules
// issue (matched by SQL fragment), so tests exercise the REAL query/bind code
// — including the UNIQUE-email guard and the session↔user JOIN that guarantees
// a session's user still exists in D1.
export function createFakeD1() {
  const users = new Map(); // id -> row
  const sessions = new Map(); // id -> row

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
    _sessions: sessions,
    _expireAllSessions() {
      for (const s of sessions.values()) s.expires_at = "2000-01-01T00:00:00.000Z";
    },
  };
}
