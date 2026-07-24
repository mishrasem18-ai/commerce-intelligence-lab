import "server-only";
import { getDb } from "@/lib/db/client";

/** Auth-facing view of a user (includes the password hash — server only). */
export interface UserAuthRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
}

/** Public buyer identity handed to the client after auth. */
export interface BuyerIdentity {
  customerId: string;
  email: string;
  name: string;
}

export interface NewUserInput {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  passwordHash: string;
}

function generateUserId(): string {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const hex = [...rand].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `C-${hex.toUpperCase()}`;
}

/** Case-insensitive lookup used for uniqueness + login. */
export async function getUserByEmail(email: string): Promise<UserAuthRecord | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<{ id: string; email: string; name: string; password_hash: string | null }>();
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash };
}

/** Create a real buyer/user row in D1. Returns the public identity. */
export async function createUser(input: NewUserInput): Promise<BuyerIdentity> {
  const db = await getDb();
  const id = generateUserId();
  const email = input.email.trim().toLowerCase();
  const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim() || email;
  await db
    .prepare(
      "INSERT INTO users (id, email, password_hash, name, first_name, last_name, mobile, status) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'New')",
    )
    .bind(
      id,
      email,
      input.passwordHash,
      name,
      input.firstName.trim(),
      input.lastName.trim(),
      input.mobile.trim(),
      // status bound in SQL literal
    )
    .run();
  return { customerId: id, email, name };
}

/** Update a user's order metrics after a successful order (server-side). */
export async function recordUserOrder(
  userId: string,
  amountCents: number,
  dateISO: string,
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      "UPDATE users SET orders_count = orders_count + 1, spent_cents = spent_cents + ?, " +
        "last_order_at = ?, status = CASE WHEN status = 'New' THEN 'Active' ELSE status END, " +
        "updated_at = datetime('now') WHERE id = ?",
    )
    .bind(amountCents, dateISO, userId)
    .run();
}
