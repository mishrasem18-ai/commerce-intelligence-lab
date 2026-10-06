import { redirect } from "next/navigation";
import { currentAdminSession } from "@/lib/auth/guards";
import { getCustomersForAdmin, getOrdersForAdmin } from "@/lib/db/admin-data";
import { OrdersProvider } from "@/lib/store/orders-store";
import { CustomersProvider } from "@/lib/store/customers-store";
import { AppShell } from "@/components/layout/app-shell";

// Server-side gate: the admin session (HttpOnly cookie) is validated against D1
// whenever this layout renders. Middleware still does a cheap cookie-presence
// redirect; this rejects missing/expired/forged sessions. A layout is not
// re-rendered on client-side navigation, so every admin page that reads
// customer or order records checks the session again itself.
//
// This is the only place the full order and customer lists are handed to the
// browser: they are read after the session check and seed the admin stores,
// which exist only inside this layout.
export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentAdminSession())) redirect("/admin/login");
  const [orders, customers] = await Promise.all([getOrdersForAdmin(), getCustomersForAdmin()]);

  return (
    <OrdersProvider initial={orders}>
      <CustomersProvider initial={customers}>
        <AppShell>{children}</AppShell>
      </CustomersProvider>
    </OrdersProvider>
  );
}
