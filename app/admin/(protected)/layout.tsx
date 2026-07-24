import { AdminGuard } from "@/components/admin/admin-guard";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AppShell>{children}</AppShell>
    </AdminGuard>
  );
}
