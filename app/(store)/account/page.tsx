import type { Metadata } from "next";
import { AccountDashboard } from "@/components/store/account-dashboard";

export const metadata: Metadata = { title: { absolute: "My Account · Aurora Market" } };

export default function AccountPage() {
  return <AccountDashboard />;
}
