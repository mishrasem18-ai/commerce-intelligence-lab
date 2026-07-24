import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/db/users";
import { hashPassword } from "@/lib/auth/password";
import { createBuyerSession, BUYER_COOKIE } from "@/lib/auth/session";

// Buyer registration -> real D1 user row + server session. No plaintext stored.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const mobile = typeof body?.mobile === "string" ? body.mobile.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const email = emailRaw.trim().toLowerCase();

    if (!email || !password || !firstName) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password is too short." }, { status: 400 });
    }
    if (await getUserByEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const buyer = await createUser({ firstName, lastName, email, mobile, passwordHash });
    const { token, expiresAt } = await createBuyerSession(buyer.customerId);

    const res = NextResponse.json({ ok: true, buyer });
    res.cookies.set(BUYER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (error) {
    console.error("[api/auth/register] failed:", error);
    return NextResponse.json({ ok: false, error: "Registration failed." }, { status: 500 });
  }
}
