import "server-only";
import { getDb } from "@/lib/db/client";

export interface Category {
  id: string;
  name: string;
}

/** All product categories from D1, in insertion order. */
export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT id, name FROM categories ORDER BY rowid")
    .all<Category>();
  return results;
}
