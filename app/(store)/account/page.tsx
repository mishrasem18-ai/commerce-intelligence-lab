import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { AccountDashboard } from "@/components/store/account-dashboard";

export const metadata: Metadata = routeMetadata("account");

export default function AccountPage() {
  return <AccountDashboard />;
}
