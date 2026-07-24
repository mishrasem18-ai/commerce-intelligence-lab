/**
 * Server-side buyer authentication tests (Phase D).
 * Run: node --experimental-strip-types --import ./test/register.mjs \
 *        --test lib/db/buyer-auth.test.ts
 *
 * These drive the REAL query code in lib/db/users.ts and lib/auth/session.ts
 * against an in-memory fake D1 (injected via __setTestDb). The API routes under
 * app/api/auth/* are thin HTTP wrappers over exactly these functions, so this
 * covers the security-critical behavior: D1 is the sole authority for buyer
 * identity, passwords are only ever stored hashed, and no fabricated
 * client/localStorage object can produce a valid session.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "../../test/fake-d1.mjs";
import { __setTestDb } from "./client.ts";
import { getUserByEmail, createUser } from "./users.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { createBuyerSession, getBuyerSession, deleteSession } from "../auth/session.ts";

let db: ReturnType<typeof createFakeD1>;

beforeEach(() => {
  db = createFakeD1();
  __setTestDb(db as never);
});

async function register(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  return createUser({ firstName: "Test", lastName: "Buyer", email, mobile: "+1 555 0100", passwordHash });
}

// 1. Registration creates a real D1 user record.
test("registration persists a user row in D1", async () => {
  const buyer = await register("new@example.com", "s3cret!");
  assert.match(buyer.customerId, /^C-/);
  const found = await getUserByEmail("new@example.com");
  assert.ok(found, "user must be queryable from D1 after registration");
  assert.equal(found.email, "new@example.com");
});

// 2. Passwords are stored hashed, never in plaintext.
test("stored password is a PBKDF2 hash, not plaintext", async () => {
  await register("hash@example.com", "plaintext-pw");
  const [row] = [...db._users.values()];
  assert.notEqual(row.password_hash, "plaintext-pw");
  assert.match(row.password_hash, /^pbkdf2\$sha256\$\d+\$/);
  assert.ok(!JSON.stringify(row).includes("plaintext-pw"), "plaintext must not appear anywhere in the row");
});

// 3. Duplicate email (normalized) is rejected.
test("duplicate email registration is rejected", async () => {
  await register("dupe@example.com", "pw123456");
  // Uniqueness is checked case-insensitively (email normalized before insert).
  assert.ok(await getUserByEmail("DUPE@example.com"), "lookup is case-insensitive");
  await assert.rejects(() => register("dupe@example.com", "other-pw"), /UNIQUE/);
});

// 4. Valid login: correct password verifies against the stored hash.
test("valid credentials verify against the D1 hash", async () => {
  await register("login@example.com", "correct-horse");
  const user = await getUserByEmail("login@example.com");
  assert.ok(user?.passwordHash);
  assert.equal(await verifyPassword("correct-horse", user.passwordHash), true);
});

// 5. Wrong password is rejected.
test("wrong password is rejected", async () => {
  await register("wrong@example.com", "correct-horse");
  const user = await getUserByEmail("wrong@example.com");
  assert.equal(await verifyPassword("wrong-password", user!.passwordHash!), false);
});

// 6. A buyer not present in D1 can never authenticate.
test("nonexistent D1 user cannot be looked up or logged in", async () => {
  const user = await getUserByEmail("ghost@example.com");
  assert.equal(user, null); // no row -> login route returns 401
});

// 7. Fabricated client/localStorage identity cannot authenticate.
// The old bug: a browser-invented buyer + a client-set cookie was trusted.
// Now identity comes only from a server session token that must exist in D1.
test("a forged/never-issued session token resolves to no buyer", async () => {
  const forged = "ff".repeat(32); // looks like a token but was never created server-side
  assert.equal(await getBuyerSession(forged), null);
});

// 8. A valid server session is accepted and returns the D1 identity.
test("a valid server session resolves to the buyer identity", async () => {
  const buyer = await register("session@example.com", "pw123456");
  const { token } = await createBuyerSession(buyer.customerId);
  const info = await getBuyerSession(token);
  assert.ok(info);
  assert.equal(info.userId, buyer.customerId);
  assert.equal(info.email, "session@example.com");
});

// 9. Forged session (random token, not the stored SHA-256) is rejected.
test("a random token that is not the stored hash is rejected", async () => {
  await register("s9@example.com", "pw123456");
  await createBuyerSession((await getUserByEmail("s9@example.com"))!.id);
  assert.equal(await getBuyerSession("deadbeef".repeat(8)), null);
});

// 10. Expired session is rejected.
test("an expired session is rejected", async () => {
  const buyer = await register("exp@example.com", "pw123456");
  const { token } = await createBuyerSession(buyer.customerId);
  assert.ok(await getBuyerSession(token), "valid before expiry");
  db._expireAllSessions();
  assert.equal(await getBuyerSession(token), null, "rejected after expiry");
});

// 11. Logout invalidates the server session.
test("logout deletes the session so it no longer resolves", async () => {
  const buyer = await register("out@example.com", "pw123456");
  const { token } = await createBuyerSession(buyer.customerId);
  assert.ok(await getBuyerSession(token));
  await deleteSession(token);
  assert.equal(await getBuyerSession(token), null);
});

// 12. Checkout identity: a session whose user does not exist in D1 is rejected
// (the JOIN guarantees existence). This is exactly the testingnew@test.com case
// — a session/identity with no backing D1 user — and it must NOT authenticate.
test("a session pointing at a nonexistent user is rejected (checkout guard)", async () => {
  const { token } = await createBuyerSession("C-DOESNOTEXIST");
  assert.equal(await getBuyerSession(token), null);
});
