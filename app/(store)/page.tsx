import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { HomeView } from "@/components/store/home-view";

export const metadata: Metadata = {
  ...routeMetadata("home"),
  description:
    "Shop premium electronics, fashion, home and more at Aurora Market — a modern demo storefront.",
};

export default function StoreHomePage() {
  return <HomeView />;
}
