import { NextResponse } from "next/server";
import { deleteSession, BUYER_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${BUYER_COOKIE}=`))
    ?.slice(BUYER_COOKIE.length + 1);
  try {
    if (token) await deleteSession(decodeURIComponent(token));
  } catch (error) {
    console.error("[api/auth/logout] failed:", error);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BUYER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
