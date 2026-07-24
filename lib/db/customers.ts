import "server-only";
import { getDb } from "@/lib/db/client";
import type { Customer } from "@/lib/data";

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  country: string | null;
  country_code: string | null;
  status: string;
  orders_count: number;
  spent_cents: number;
  last_order_at: string | null;
  created_at: string;
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    country: row.country ?? "",
    countryCode: row.country_code ?? "",
    orders: row.orders_count,
    spent: row.spent_cents / 100,
    status: row.status as Customer["status"],
    // No dedicated "last seen" column; derive from last order date (or —).
    lastSeen: row.last_order_at ? row.last_order_at.slice(0, 10) : "—",
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    mobile: row.mobile ?? undefined,
    lastOrderDate: row.last_order_at ?? undefined,
    joinedAt: row.created_at,
  };
}

/** All customers/users, highest spenders first. */
export async function getCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT * FROM users ORDER BY spent_cents DESC, id")
    .all<CustomerRow>();
  return results.map(toCustomer);
}

/** A single customer by id, or null. */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<CustomerRow>();
  return row ? toCustomer(row) : null;
}
