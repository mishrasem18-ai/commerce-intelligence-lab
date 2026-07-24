import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { createBuyerSession, BUYER_COOKIE } from "@/lib/auth/session";

// Buyer login -> verified against the D1 users.password_hash. A user that does
// not exist in D1 (or has no password) can NEVER authenticate.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Missing credentials." }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    const valid = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : false;
    if (!user || !valid) {
      return NextResponse.json({ ok: false, error: "Incorrect email or password." }, { status: 401 });
    }

    const { token, expiresAt } = await createBuyerSession(user.id);
    const res = NextResponse.json({
      ok: true,
      buyer: { customerId: user.id, email: user.email, name: user.name },
    });
    res.cookies.set(BUYER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (error) {
    console.error("[api/auth/login] failed:", error);
    return NextResponse.json({ ok: false, error: "Login failed." }, { status: 500 });
  }
}
