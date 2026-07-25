/**
 * End-to-end buyer auth flow against a RUNNING LOCAL dev server + LOCAL D1.
 *
 *   npm run dev            # terminal 1 (local D1 via Miniflare)
 *   npm run test:integration
 *
 * This is the server half of the "no manual refresh" guarantee: it drives the
 * real routes in the real runtime and asserts that every buyer auth response
 * carries BOTH the identity and the full customer profile. That payload is what
 * lets the client render /account on arrival — before this, the client had only
 * an identity and had to wait for a full page reload to pick the profile up from
 * the server-rendered snapshot.
 *
 * Safety: refuses to run against anything but localhost, so it can never touch
 * production D1. It creates one throwaway buyer per run and never deletes,
 * mutates or reseeds existing rows.
 */

import { test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  throw new Error(
    `Refusing to run the integration suite against "${BASE}". Localhost only — ` +
      "this test writes a buyer row and must never reach production D1.",
  );
}

const stamp = `${Date.now().toString(36)}-${process.pid}`;
const EMAIL = `it-${stamp}@example.test`;
const PASSWORD = "integration-pw-123";
const FIRST = "Integration";
const LAST = `Buyer${stamp.slice(-4)}`;

/** Minimal cookie jar (the session cookie is HttpOnly, exactly as in a browser). */
const jar = new Map();

function readCookies(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(jar.size ? { cookie: cookieHeader() } : {}),
      ...init.headers,
    },
  });
  readCookies(res);
  return res;
}

before(async () => {
  const res = await fetch(BASE).catch(() => null);
  assert.ok(res, `No dev server at ${BASE}. Start it with \`npm run dev\` first.`);
});

let registered;

// 1-6. Register → D1 row + session cookie + the full profile in the response.
test("registration returns identity AND profile with a session cookie", async () => {
  const res = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: FIRST,
      lastName: LAST,
      email: EMAIL,
      mobile: "+91 98765 43210",
      password: PASSWORD,
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.buyer?.customerId, "identity is returned");
  assert.equal(data.buyer.email, EMAIL);

  // The fix: the client no longer has to reload to learn the buyer's profile.
  assert.ok(data.customer, "registration response must include the D1 profile");
  assert.equal(data.customer.id, data.buyer.customerId);
  assert.equal(data.customer.email, EMAIL);
  assert.equal(data.customer.name, `${FIRST} ${LAST}`);
  assert.equal(data.customer.mobile, "+91 98765 43210");

  // No secret material ever reaches the browser.
  const serialized = JSON.stringify(data);
  assert.ok(!serialized.includes(PASSWORD), "no plaintext password in the response");
  assert.ok(!serialized.includes("pbkdf2"), "no password hash in the response");

  assert.ok(jar.has("cil_buyer"), "a session cookie was issued");
  registered = data.buyer.customerId;
});

// 3. Duplicate email is still rejected.
test("registering the same email twice is rejected", async () => {
  const res = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: FIRST,
      lastName: LAST,
      email: EMAIL,
      mobile: "+91 98765 43210",
      password: PASSWORD,
    }),
  });
  assert.equal(res.status, 409);
});

// 4-8. The session endpoint serves everything /account needs, immediately.
test("session endpoint returns the buyer and profile for the new cookie", async () => {
  const res = await call("/api/auth/session");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.buyer?.customerId, registered);
  assert.ok(data.customer, "session response must include the profile");
  assert.equal(data.customer.id, registered);
  assert.equal(data.customer.name, `${FIRST} ${LAST}`);
});

// 13. The protected account route is reachable with the session (no redirect).
test("GET /account with a valid session renders instead of redirecting", async () => {
  const res = await call("/account");
  assert.equal(res.status, 200, "a signed-in buyer is not bounced to /login");
  const html = await res.text();
  assert.ok(html.includes("My Account"), "the account shell rendered");
});

// 10. Logout invalidates the session server-side.
test("logout clears the cookie and invalidates the session", async () => {
  const res = await call("/api/auth/logout", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(jar.has("cil_buyer"), false, "cookie cleared");

  const after = await call("/api/auth/session");
  const data = await after.json();
  assert.equal(data.buyer, null, "session no longer resolves");
  assert.equal(data.customer, null);
});

// 13/14. Protected routes reject an unauthenticated buyer.
test("protected routes redirect when signed out", async () => {
  for (const path of ["/account", "/account/orders", "/checkout"]) {
    const res = await call(path);
    assert.equal(res.status, 307, `${path} redirects when signed out`);
    assert.match(res.headers.get("location") ?? "", /\/login/);
  }
});

// 11. A forged cookie is unauthenticated (not a hang, not an error).
test("a forged session cookie resolves to no buyer", async () => {
  jar.set("cil_buyer", "ff".repeat(32));
  const res = await call("/api/auth/session");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.buyer, null);
  jar.delete("cil_buyer");
});

// 9. Login returns the same identity + profile contract as registration.
test("login returns identity and profile without any reload", async () => {
  const res = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.buyer.customerId, registered);
  assert.ok(data.customer, "login response must include the profile");
  assert.equal(data.customer.id, registered);
  assert.ok(jar.has("cil_buyer"));

  const account = await call("/account");
  assert.equal(account.status, 200, "account is reachable straight after login");
});

// Wrong password is still rejected (and issues no cookie).
test("wrong password is rejected", async () => {
  jar.delete("cil_buyer");
  const res = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: "not-the-password" }),
  });
  assert.equal(res.status, 401);
  assert.equal(jar.has("cil_buyer"), false);
});

// Admin and buyer auth stay isolated: a buyer session is not an admin session.
test("a buyer session cannot authenticate the admin area", async () => {
  const login = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.equal(login.status, 200);
  const adminSession = await call("/api/admin/session");
  const data = await adminSession.json();
  assert.equal(data.admin ?? null, null, "buyer cookie grants no admin identity");
  const dashboard = await call("/admin/dashboard");
  assert.equal(dashboard.status, 307, "admin area still redirects to admin login");
});
