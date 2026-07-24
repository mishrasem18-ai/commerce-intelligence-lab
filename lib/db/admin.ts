import "server-only";
import { getDb } from "@/lib/db/client";

export interface AdminAccount {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
}

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
}

/** Look up an admin operator by email (case-insensitive). Authoritative source. */
export async function getAdminByEmail(email: string): Promise<AdminAccount | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, email, name, password_hash FROM admin_users WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<AdminRow>();
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash };
}
