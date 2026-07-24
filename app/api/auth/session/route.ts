import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBuyerSession, BUYER_COOKIE } from "@/lib/auth/session";

// Returns the current buyer identity (validated against D1) or null.
export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(BUYER_COOKIE)?.value;
  const session = token ? await getBuyerSession(token) : null;
  return NextResponse.json({
    buyer: session ? { customerId: session.userId, email: session.email, name: session.name } : null,
  });
}
