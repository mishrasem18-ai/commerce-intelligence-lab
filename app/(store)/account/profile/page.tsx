import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { BuyerProfileForm } from "@/components/store/buyer-profile-form";

export const metadata: Metadata = routeMetadata("account_profile");

export default function AccountProfilePage() {
  return <BuyerProfileForm />;
}
