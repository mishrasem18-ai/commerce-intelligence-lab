import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession, ADMIN_COOKIE } from "@/lib/auth/session";

// Returns the current admin identity (for client UI hydration) or null.
export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = token ? await getAdminSession(token) : null;
  return NextResponse.json({
    admin: session ? { email: session.email, name: session.name } : null,
  });
}
