/**
 * Admin credential-verification tests (server-side PBKDF2).
 * Run: node --experimental-strip-types --test lib/auth/password.test.ts
 *
 * Covers: valid password accepted, wrong password rejected, legacy "admin123"
 * rejected, and malformed hashes rejected. No secret values are used — a fresh
 * random hash is generated per run.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { verifyPassword } from "./password.ts";

// Build a stored hash in the same format the app uses, for an arbitrary password.
function makeHash(password: string): string {
  const iterations = 100000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return `pbkdf2$sha256$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const SECRET = `pw-${randomBytes(9).toString("base64url")}`;
const stored = makeHash(SECRET);

test("accepts the correct password", async () => {
  assert.equal(await verifyPassword(SECRET, stored), true);
});

test("rejects a wrong password", async () => {
  assert.equal(await verifyPassword(SECRET + "x", stored), false);
  assert.equal(await verifyPassword("totally-wrong", stored), false);
});

test("rejects the legacy admin123 password", async () => {
  assert.equal(await verifyPassword("admin123", stored), false);
});

test("rejects malformed / empty stored hashes", async () => {
  assert.equal(await verifyPassword(SECRET, ""), false);
  assert.equal(await verifyPassword(SECRET, "unset"), false);
  assert.equal(await verifyPassword(SECRET, "not$a$valid$hash"), false);
  assert.equal(await verifyPassword(SECRET, "bcrypt$sha256$1$aa$bb"), false);
});

test("is sensitive to iteration count (hash integrity)", async () => {
  const tampered = stored.replace("$100000$", "$1$");
  assert.equal(await verifyPassword(SECRET, tampered), false);
});
