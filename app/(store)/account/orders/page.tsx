import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { BuyerOrdersList } from "@/components/store/buyer-orders-list";

export const metadata: Metadata = routeMetadata("account_orders");

export default function AccountOrdersPage() {
  return <BuyerOrdersList />;
}
