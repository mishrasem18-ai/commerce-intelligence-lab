"use client";

import * as React from "react";
import { useBuyerAccount } from "@/lib/store/buyer-account-store";
import { analytics } from "@/lib/analytics";
import type { BuyerAuthStatus } from "@/lib/auth/buyer-state";
import type { Customer } from "@/lib/data";

/*
 * Authentication authority is SERVER-SIDE (Cloudflare D1). Both admin and buyer
 * credentials are verified server-side (PBKDF2 against admin_users / users), and
 * sessions are opaque HttpOnly cookies backed by the D1 `sessions` table:
 *   admin: /api/admin/{login,logout,session}
 *   buyer: /api/auth/{register,login,logout,session}
 * No password, password hash, or session secret is ever shipped to the browser,
 * and NO localStorage object can independently authenticate a user. This client
 * store only mirrors the server-validated identity for UI purposes.
 *
 * This store is the SINGLE client-side source of truth for "who is signed in".
 * Every auth response (register / login / session) carries both the identity and
 * the buyer's full D1 customer profile, and this store hands that profile to
 * the buyer account store (lib/store/buyer-account-store.tsx) — the buyer's own
 * record, and the only customer record the storefront holds. No customer data
 * is server-rendered into the page, so account screens never depend on a
 * snapshot that predates a just-registered buyer. The only identity the server
 * renders is the buyer's own opaque customer id, and only analytics reads it
 * (AnalyticsIdentitySeed below).
 */

export const ADMIN_COOKIE = "cil_admin";
export const BUYER_COOKIE = "cil_buyer";

interface AdminSession {
  email: string;
}
interface BuyerSession {
  customerId: string;
  email: string;
  name: string;
}

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  customerId?: string;
}

/** Shape of every buyer auth response (register / login / session). */
interface BuyerAuthPayload {
  ok?: boolean;
  error?: string;
  buyer?: BuyerSession | null;
  customer?: Customer | null;
}

interface AuthContextValue {
  admin: AdminSession | null;
  buyer: BuyerSession | null;
  /** True once the initial session resolution has settled (any outcome). */
  hydrated: boolean;
  /** Explicit buyer session state — never sticks on "loading". */
  buyerStatus: BuyerAuthStatus;
  /** Re-validate the buyer session against the server (used by error retries). */
  refreshBuyer: () => Promise<void>;
  /** Re-validate the admin session against the server; resolves to whether one exists. */
  refreshAdmin: () => Promise<boolean>;
  signInAdmin: (email: string, password: string) => Promise<AuthResult>;
  signOutAdmin: () => Promise<void>;
  signupBuyer: (input: SignupInput) => Promise<AuthResult>;
  loginBuyer: (email: string, password: string) => Promise<AuthResult>;
  logoutBuyer: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * Gives analytics the signed-in buyer's customer id before the document's
 * first event. The browser's session check (below) only settles after the
 * first page.view — and after a product page's view_item — so on a hard load
 * those events had no customer id. The root layout validates the session
 * cookie against D1 and passes the id here.
 *
 * A layout effect of a component rendered BEFORE the page: React runs it
 * ahead of the layout effects of everything after it, including the
 * page-view tracker's. Never during render, which also runs on the server,
 * where the analytics singleton is shared by all requests.
 *
 * It runs once per document. From then on this store is the authority: login,
 * logout and the session check set the user context as before.
 */
function AnalyticsIdentitySeed({ customerId }: { customerId: string | null }) {
  const seeded = React.useRef(false);
  React.useLayoutEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (customerId) {
      analytics.setUserContext({ authentication_state: "authenticated", customer_id: customerId });
    }
  }, [customerId]);
  return null;
}

export function AuthProvider({
  children,
  serverCustomerId,
}: {
  children: React.ReactNode;
  /** Customer id of the request's D1-validated buyer session, or null. */
  serverCustomerId: string | null;
}) {
  const { identify: identifyBuyerAccount, clear: clearBuyerAccount } = useBuyerAccount();
  const [admin, setAdmin] = React.useState<AdminSession | null>(null);
  const [buyer, setBuyer] = React.useState<BuyerSession | null>(null);
  const [buyerStatus, setBuyerStatus] = React.useState<BuyerAuthStatus>("loading");
  const [hydrated, setHydrated] = React.useState(false);

  /**
   * Apply a buyer auth response: the identity AND the server's customer profile
   * land in the same React batch, so no consumer ever observes "signed in but no
   * profile" (the state that used to render an endless spinner).
   */
  const applyBuyerPayload = React.useCallback(
    (data: BuyerAuthPayload | null) => {
      if (data?.buyer) {
        setBuyer(data.buyer);
        identifyBuyerAccount(data.buyer.customerId, data.customer ?? null);
        setBuyerStatus("authenticated");
        // Analytics identity is ONLY the internal customer id — never the
        // buyer's email or name.
        analytics.setUserContext({
          authentication_state: "authenticated",
          customer_id: data.buyer.customerId,
        });
        return true;
      }
      setBuyer(null);
      clearBuyerAccount();
      setBuyerStatus("unauthenticated");
      analytics.setUserContext({ authentication_state: "guest" });
      return false;
    },
    [identifyBuyerAccount, clearBuyerAccount],
  );

  /** Re-read the server-validated buyer session. Never throws. */
  const refreshBuyer = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`session request failed: ${res.status}`);
      applyBuyerPayload((await res.json()) as BuyerAuthPayload);
    } catch {
      // Transport/server failure is NOT "signed out" — surface it as an error so
      // the UI can offer a retry instead of spinning forever.
      setBuyerStatus("error");
    }
  }, [applyBuyerPayload]);

  // Identity is resolved from server-validated sessions (HttpOnly cookie → D1).
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/session", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/auth/session", { credentials: "same-origin" })
        .then((r) => {
          if (!r.ok) throw new Error(`session request failed: ${r.status}`);
          return r.json() as Promise<BuyerAuthPayload>;
        })
        .catch(() => "error" as const),
    ])
      .then(([adminData, buyerData]) => {
        if (cancelled) return;
        if (adminData?.admin) setAdmin({ email: adminData.admin.email });
        if (buyerData === "error") setBuyerStatus("error");
        else applyBuyerPayload(buyerData);
      })
      .finally(() => {
        // Always settles — hydration can never be left pending.
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyBuyerPayload]);

  /**
   * Re-read the server-validated admin session. `admin` is only a mirror: the
   * session can end on the server (expiry, sign-out in another tab) while this
   * document still shows the admin as signed in. A failed request leaves the
   * mirror as it is and reports "no session".
   */
  const refreshAdmin = React.useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { admin?: { email: string } | null };
      const email = data.admin?.email ?? null;
      setAdmin((prev) => (prev?.email === email ? prev : email ? { email } : null));
      return email !== null;
    } catch {
      return false;
    }
  }, []);

  const signInAdmin = React.useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          admin?: { email: string };
        } | null;
        if (res.ok && data?.ok && data.admin) {
          setAdmin({ email: data.admin.email });
          return { ok: true };
        }
        return { ok: false, error: data?.error ?? "Invalid admin credentials." };
      } catch {
        return { ok: false, error: "Sign in failed." };
      }
    },
    [],
  );

  const signOutAdmin = React.useCallback(async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    setAdmin(null);
  }, []);

  const signupBuyer = React.useCallback(
    async (input: SignupInput): Promise<AuthResult> => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(input),
        });
        const data = (await res.json().catch(() => null)) as BuyerAuthPayload | null;
        if (res.ok && data?.ok && data.buyer) {
          // Identity + profile become authoritative here — before the caller
          // navigates — so /account renders on arrival with no refresh.
          applyBuyerPayload(data);
          // Canonical signup event — identity context only, no PII payload.
          analytics.track("user.sign_up");
          return { ok: true, customerId: data.buyer.customerId };
        }
        return { ok: false, error: data?.error ?? "Could not create account." };
      } catch {
        return { ok: false, error: "Sign up failed." };
      }
    },
    [applyBuyerPayload],
  );

  const loginBuyer = React.useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json().catch(() => null)) as BuyerAuthPayload | null;
        if (res.ok && data?.ok && data.buyer) {
          applyBuyerPayload(data);
          // Canonical login event — identity context only, no PII payload.
          analytics.track("user.login");
          return { ok: true, customerId: data.buyer.customerId };
        }
        return { ok: false, error: data?.error ?? "Incorrect email or password." };
      } catch {
        return { ok: false, error: "Sign in failed." };
      }
    },
    [applyBuyerPayload],
  );

  const logoutBuyer = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    setBuyer(null);
    // The next person on this browser must not find this buyer's profile or orders.
    clearBuyerAccount();
    setBuyerStatus("unauthenticated");
    // Track while the identity context still holds the customer id, then reset.
    analytics.track("user.logout");
    analytics.setUserContext({ authentication_state: "guest" });
  }, [clearBuyerAccount]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      admin,
      buyer,
      hydrated,
      buyerStatus,
      refreshBuyer,
      refreshAdmin,
      signInAdmin,
      signOutAdmin,
      signupBuyer,
      loginBuyer,
      logoutBuyer,
    }),
    [
      admin,
      buyer,
      hydrated,
      buyerStatus,
      refreshBuyer,
      refreshAdmin,
      signInAdmin,
      signOutAdmin,
      signupBuyer,
      loginBuyer,
      logoutBuyer,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <AnalyticsIdentitySeed customerId={serverCustomerId} />
      {children}
    </AuthContext.Provider>
  );
}
