import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { AddressesManager } from "@/components/store/addresses-manager";

export const metadata: Metadata = routeMetadata("account_addresses");

export default function AccountAddressesPage() {
  return <AddressesManager />;
}
