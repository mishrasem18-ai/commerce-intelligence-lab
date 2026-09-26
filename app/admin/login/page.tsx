import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = routeMetadata("admin_login");

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <AdminLoginForm />
    </div>
  );
}
