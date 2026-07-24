import type { Metadata } from "next";
import { BuyerOrdersList } from "@/components/store/buyer-orders-list";

export const metadata: Metadata = { title: { absolute: "My Orders · Aurora Market" } };

export default function AccountOrdersPage() {
  return <BuyerOrdersList />;
}
