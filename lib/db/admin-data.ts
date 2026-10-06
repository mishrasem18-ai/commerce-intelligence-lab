import "server-only";
import { currentAdminSession } from "@/lib/auth/guards";
import { getCustomerById, getCustomers } from "@/lib/db/customers";
import { getOrderByNumber, getOrders } from "@/lib/db/orders";
import type { Customer, Order } from "@/lib/data";

/*
 * The ONLY way application code reads other people's customer and order
 * records. Each function validates the request's admin session against D1
 * before it queries, so a caller cannot forget the check: without a valid
 * admin session it throws instead of returning data.
 *
 * Pages and route handlers still check the session first to answer with a
 * redirect or a 401; this is the backstop behind them.
 */

export class AdminSessionRequiredError extends Error {
  constructor() {
    super("An admin session is required to read customer and order records.");
    this.name = "AdminSessionRequiredError";
  }
}

async function assertAdmin(): Promise<void> {
  if (!(await currentAdminSession())) throw new AdminSessionRequiredError();
}

/** Every order, most recent first. */
export async function getOrdersForAdmin(): Promise<Order[]> {
  await assertAdmin();
  return getOrders();
}

/** One order by its order number (the admin URL slug), or null. */
export async function getOrderForAdmin(orderNumber: string): Promise<Order | null> {
  await assertAdmin();
  return getOrderByNumber(orderNumber);
}

/** Every customer, highest spenders first. */
export async function getCustomersForAdmin(): Promise<Customer[]> {
  await assertAdmin();
  return getCustomers();
}

/** One customer by id, or null. */
export async function getCustomerForAdmin(id: string): Promise<Customer | null> {
  await assertAdmin();
  return getCustomerById(id);
}
