"use client";

import * as React from "react";

/*
 * Authentication authority is SERVER-SIDE (Cloudflare D1). Both admin and buyer
 * credentials are verified server-side (PBKDF2 against admin_users / users), and
 * sessions are opaque HttpOnly cookies backed by the D1 `sessions` table:
 *   admin: /api/admin/{login,logout,session}
 *   buyer: /api/auth/{register,login,logout,session}
 * No password, password hash, or session secret is ever shipped to the browser,
 * and NO localStorage object can independently authenticate a user. This client
 * store only mirrors the server-validated identity for UI purposes.
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

interface AuthContextValue {
  admin: AdminSession | null;
  buyer: BuyerSession | null;
  hydrated: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = React.useState<AdminSession | null>(null);
  const [buyer, setBuyer] = React.useState<BuyerSession | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  // Identity is resolved from server-validated sessions (HttpOnly cookie → D1).
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/session", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/auth/session", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([adminData, buyerData]) => {
        if (cancelled) return;
        if (adminData?.admin) setAdmin({ email: adminData.admin.email });
        if (buyerData?.buyer) setBuyer(buyerData.buyer as BuyerSession);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          buyer?: BuyerSession;
        } | null;
        if (res.ok && data?.ok && data.buyer) {
          setBuyer(data.buyer);
          return { ok: true, customerId: data.buyer.customerId };
        }
        return { ok: false, error: data?.error ?? "Could not create account." };
      } catch {
        return { ok: false, error: "Sign up failed." };
      }
    },
    [],
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
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          buyer?: BuyerSession;
        } | null;
        if (res.ok && data?.ok && data.buyer) {
          setBuyer(data.buyer);
          return { ok: true, customerId: data.buyer.customerId };
        }
        return { ok: false, error: data?.error ?? "Incorrect email or password." };
      } catch {
        return { ok: false, error: "Sign in failed." };
      }
    },
    [],
  );

  const logoutBuyer = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    setBuyer(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      admin,
      buyer,
      hydrated,
      signInAdmin,
      signOutAdmin,
      signupBuyer,
      loginBuyer,
      logoutBuyer,
    }),
    [admin, buyer, hydrated, signInAdmin, signOutAdmin, signupBuyer, loginBuyer, logoutBuyer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
