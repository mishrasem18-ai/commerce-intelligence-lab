"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/store/auth-store";

/**
 * A link to a buyer-protected route (/account*, /checkout) that does not
 * prefetch while the visitor is signed out.
 *
 * The middleware answers a signed-out request for these routes with a
 * redirect to /login. When that request is a <Link> prefetch, the router
 * caches the redirect as the route — and after the visitor signs in,
 * `router.replace("/account")` hits the stale entry and falls back to a full
 * document load. That load discarded GA4's queued `sign_up` / `login` hits
 * on live. With `prefetch={false}` nothing is cached until a buyer session
 * exists; signed-in buyers prefetch as usual.
 *
 * Use this for every link to a protected route that can render while signed
 * out (`lib/auth/protected-links.test.ts` enforces it). Links inside the
 * account area only render for a signed-in buyer and may use <Link>.
 */
export function BuyerLink(props: React.ComponentProps<typeof Link>) {
  const { buyer } = useAuth();
  return <Link {...props} prefetch={buyer ? props.prefetch : false} />;
}
