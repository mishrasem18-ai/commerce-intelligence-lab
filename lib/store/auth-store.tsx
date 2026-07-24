"use client";

import * as React from "react";
import { useCustomers } from "@/lib/store/customers-store";

/*
 * Demo authentication. Admin and buyer sessions are intentionally separate.
 * Buyer credentials live in their own store, never mixed into the customer
 * profile that the admin can see. Cookies mirror the session so middleware can
 * gate routes server-side. Swap this module for a real auth provider later —
 * the surface (signIn/signOut/signup/login) is what components depend on.
 */

/*
 * Admin authentication is verified SERVER-SIDE against D1 (admin_users) via the
 * /api/admin/{login,logout,session} endpoints. No password or password hash is
 * shipped to the browser; the admin session is an HttpOnly cookie the server
 * manages (cil_admin). Buyer auth remains client/localStorage for now (Phase D).
 */

const ACCOUNTS_KEY = "cil.buyerAccounts.v1";
const BUYER_SESSION_KEY = "cil.buyerSession.v1";

export const ADMIN_COOKIE = "cil_admin";
export const BUYER_COOKIE = "cil_buyer";

interface BuyerAccount {
  email: string;
  /** Obfuscated (not real hashing) — demo only, never displayed. */
  secret: string;
  customerId: string;
}

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
  signupBuyer: (input: SignupInput) => AuthResult;
  loginBuyer: (email: string, password: string) => AuthResult;
  logoutBuyer: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

function setCookie(name: string, value: string) {
  const expires = new Date(Date.now() + 7 * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}
function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}
function obfuscate(value: string): string {
  try {
    return btoa(encodeURIComponent(value));
  } catch {
    return value;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { addCustomer, getCustomerByEmail, getCustomer } = useCustomers();
  const [accounts, setAccounts] = React.useState<BuyerAccount[]>([]);
  const [admin, setAdmin] = React.useState<AdminSession | null>(null);
  const [buyer, setBuyer] = React.useState<BuyerSession | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    // Buyer session/accounts hydrate from localStorage (unchanged in this phase).
    try {
      const rawAccounts = window.localStorage.getItem(ACCOUNTS_KEY);
      if (rawAccounts) setAccounts(JSON.parse(rawAccounts) as BuyerAccount[]);
      const rawBuyer = window.localStorage.getItem(BUYER_SESSION_KEY);
      if (rawBuyer) {
        setBuyer(JSON.parse(rawBuyer) as BuyerSession);
        setCookie(BUYER_COOKIE, "1");
      }
    } catch {
      /* ignore malformed storage */
    }
    // Admin session is validated server-side (HttpOnly cookie → D1 sessions).
    let cancelled = false;
    fetch("/api/admin/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { admin?: { email: string } | null } | null) => {
        if (!cancelled && data?.admin) setAdmin({ email: data.admin.email });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      /* ignore */
    }
  }, [accounts, hydrated]);

  const persistBuyer = (session: BuyerSession | null) => {
    setBuyer(session);
    if (session) {
      window.localStorage.setItem(BUYER_SESSION_KEY, JSON.stringify(session));
      setCookie(BUYER_COOKIE, "1");
    } else {
      window.localStorage.removeItem(BUYER_SESSION_KEY);
      deleteCookie(BUYER_COOKIE);
    }
  };

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
    (input: SignupInput): AuthResult => {
      const email = input.email.trim().toLowerCase();
      const taken =
        accounts.some((a) => a.email === email) || Boolean(getCustomerByEmail(email));
      if (taken) return { ok: false, error: "An account with this email already exists." };

      const customer = addCustomer({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        mobile: input.mobile.trim(),
      });
      const account: BuyerAccount = {
        email,
        secret: obfuscate(input.password),
        customerId: customer.id,
      };
      setAccounts((prev) => [...prev, account]);
      persistBuyer({ customerId: customer.id, email, name: customer.name });
      return { ok: true, customerId: customer.id };
    },
    [accounts, addCustomer, getCustomerByEmail],
  );

  const loginBuyer = React.useCallback(
    (email: string, password: string): AuthResult => {
      const normalized = email.trim().toLowerCase();
      const account = accounts.find((a) => a.email === normalized);
      if (!account) return { ok: false, error: "No account found for this email." };
      if (account.secret !== obfuscate(password)) {
        return { ok: false, error: "Incorrect email or password." };
      }
      const customer = getCustomer(account.customerId);
      persistBuyer({
        customerId: account.customerId,
        email: normalized,
        name: customer?.name ?? normalized,
      });
      return { ok: true, customerId: account.customerId };
    },
    [accounts, getCustomer],
  );

  const logoutBuyer = React.useCallback(() => persistBuyer(null), []);

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
