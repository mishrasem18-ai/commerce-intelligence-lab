import type { Metadata } from "next";
import { AddressesManager } from "@/components/store/addresses-manager";

export const metadata: Metadata = { title: { absolute: "Addresses · Aurora Market" } };

export default function AccountAddressesPage() {
  return <AddressesManager />;
}
