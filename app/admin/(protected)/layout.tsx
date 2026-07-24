import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAdminSession, ADMIN_COOKIE } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

// Server-side gate: the admin session (HttpOnly cookie) is validated against D1
// on every request. Middleware still does a cheap cookie-presence redirect;
// this is the authoritative check that rejects missing/expired/forged sessions.
export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = token ? await getAdminSession(token) : null;
  if (!session) redirect("/admin/login");

  return <AppShell>{children}</AppShell>;
}
