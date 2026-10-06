import { redirect } from "next/navigation";
import { currentAdminSession } from "@/lib/auth/guards";
import { AppShell } from "@/components/layout/app-shell";

// Server-side gate: the admin session (HttpOnly cookie) is validated against D1
// whenever this layout renders. Middleware still does a cheap cookie-presence
// redirect; this rejects missing/expired/forged sessions. A layout is not
// re-rendered on client-side navigation, so every admin page that reads
// customer or order records checks the session again itself.
export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentAdminSession())) redirect("/admin/login");

  return <AppShell>{children}</AppShell>;
}
