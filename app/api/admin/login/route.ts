import { NextResponse } from "next/server";
import { getAdminByEmail } from "@/lib/db/admin";
import { verifyPassword } from "@/lib/auth/password";
import { createAdminSession, ADMIN_COOKIE } from "@/lib/auth/session";

// Server-side admin credential verification against the authoritative D1
// admin_users.password_hash. No hash is ever sent to the browser.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Missing credentials." }, { status: 400 });
    }

    const admin = await getAdminByEmail(email);
    const valid = admin ? await verifyPassword(password, admin.passwordHash) : false;
    if (!admin || !valid) {
      return NextResponse.json({ ok: false, error: "Invalid admin credentials." }, { status: 401 });
    }

    const { token, expiresAt } = await createAdminSession(admin.id);
    const res = NextResponse.json({ ok: true, admin: { email: admin.email, name: admin.name } });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (error) {
    console.error("[api/admin/login] failed:", error);
    return NextResponse.json({ ok: false, error: "Login failed." }, { status: 500 });
  }
}
