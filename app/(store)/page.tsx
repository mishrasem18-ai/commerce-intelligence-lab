import type { Metadata } from "next";
import { HomeView } from "@/components/store/home-view";

export const metadata: Metadata = {
  title: { absolute: "Aurora Market — Tech, Style & Essentials" },
  description:
    "Shop premium electronics, fashion, home and more at Aurora Market — a modern demo storefront.",
};

export default function StoreHomePage() {
  return <HomeView />;
}
