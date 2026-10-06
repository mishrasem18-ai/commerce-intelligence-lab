import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  BUYER_COOKIE,
  getAdminSession,
  getBuyerSession,
  type AdminSessionInfo,
  type BuyerSessionInfo,
} from "@/lib/auth/session";

/*
 * Who is making this request, decided on the server from the HttpOnly session
 * cookie and the D1 `sessions` table. A missing, expired or forged cookie
 * resolves to null.
 *
 * The middleware only checks that a cookie is PRESENT, and a layout is not
 * re-rendered on client-side navigation, so neither is an authorization check.
 * Every page, layout and route handler that returns customer or order data
 * calls one of these itself. `cache` makes a layout and its page share one D1
 * lookup per request.
 */

/** The request's admin session, or null. */
export const currentAdminSession = cache(async (): Promise<AdminSessionInfo | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? getAdminSession(token) : null;
});

/** The request's buyer session, or null. */
export const currentBuyerSession = cache(async (): Promise<BuyerSessionInfo | null> => {
  const token = (await cookies()).get(BUYER_COOKIE)?.value;
  return token ? getBuyerSession(token) : null;
});
