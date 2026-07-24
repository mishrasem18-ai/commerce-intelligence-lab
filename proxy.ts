import { NextResponse, type NextRequest } from "next/server";

/*
 * Demo route protection. Sessions are mirrored into presence cookies by the
 * auth store so the edge can gate routes before any admin/account UI is served.
 * Replace the cookie check with a verified token when real auth lands.
 */
const ADMIN_COOKIE = "cil_admin";
const BUYER_COOKIE = "cil_buyer";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin area — everything under /admin except the login page itself.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.cookies.get(ADMIN_COOKIE)) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Buyer-only areas — the account section and checkout require a buyer session.
  if (pathname.startsWith("/account") || pathname === "/checkout") {
    if (!req.cookies.get(BUYER_COOKIE)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/account", "/account/:path*", "/checkout"],
};
