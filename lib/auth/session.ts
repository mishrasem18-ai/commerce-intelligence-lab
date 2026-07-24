import "server-only";
import { getDb } from "@/lib/db/client";

/** Cookies carrying opaque session tokens (server-managed, HttpOnly). */
export const ADMIN_COOKIE = "cil_admin";
export const BUYER_COOKIE = "cil_buyer";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Opaque 256-bit session token (the raw value goes to the cookie only). */
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** We store only SHA-256(token) in the DB, never the raw token. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export interface AdminSessionInfo {
  adminUserId: string;
  email: string;
  name: string | null;
}

/** Create an admin session row and return the raw token + expiry for the cookie. */
export async function createAdminSession(
  adminUserId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = newToken();
  const id = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .prepare(
      "INSERT INTO sessions (id, kind, admin_user_id, expires_at) VALUES (?, 'admin', ?, ?)",
    )
    .bind(id, adminUserId, expiresAt.toISOString())
    .run();
  return { token, expiresAt };
}

/** Resolve a valid (non-expired) admin session from a raw token, or null. */
export async function getAdminSession(token: string): Promise<AdminSessionInfo | null> {
  if (!token) return null;
  const db = await getDb();
  const id = await hashToken(token);
  const row = await db
    .prepare(
      "SELECT s.admin_user_id AS aid, a.email AS email, a.name AS name " +
        "FROM sessions s JOIN admin_users a ON a.id = s.admin_user_id " +
        "WHERE s.id = ? AND s.kind = 'admin' AND s.expires_at > ?",
    )
    .bind(id, new Date().toISOString())
    .first<{ aid: string; email: string; name: string | null }>();
  if (!row) return null;
  return { adminUserId: row.aid, email: row.email, name: row.name };
}

export interface BuyerSessionInfo {
  userId: string;
  email: string;
  name: string;
}

/** Create a buyer session row and return the raw token + expiry for the cookie. */
export async function createBuyerSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = newToken();
  const id = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .prepare("INSERT INTO sessions (id, kind, user_id, expires_at) VALUES (?, 'buyer', ?, ?)")
    .bind(id, userId, expiresAt.toISOString())
    .run();
  return { token, expiresAt };
}

/** Resolve a valid (non-expired) buyer session from a raw token, or null.
 * The JOIN guarantees the user still EXISTS in D1 — a session whose user row is
 * gone (or was never persisted) resolves to null. */
export async function getBuyerSession(token: string): Promise<BuyerSessionInfo | null> {
  if (!token) return null;
  const db = await getDb();
  const id = await hashToken(token);
  const row = await db
    .prepare(
      "SELECT s.user_id AS uid, u.email AS email, u.name AS name " +
        "FROM sessions s JOIN users u ON u.id = s.user_id " +
        "WHERE s.id = ? AND s.kind = 'buyer' AND s.expires_at > ?",
    )
    .bind(id, new Date().toISOString())
    .first<{ uid: string; email: string; name: string }>();
  if (!row) return null;
  return { userId: row.uid, email: row.email, name: row.name };
}

/** Invalidate a session by its raw token (logout). */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  const db = await getDb();
  const id = await hashToken(token);
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}
