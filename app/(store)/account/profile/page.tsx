import type { Metadata } from "next";
import { BuyerProfileForm } from "@/components/store/buyer-profile-form";

export const metadata: Metadata = { title: { absolute: "Profile · Aurora Market" } };

export default function AccountProfilePage() {
  return <BuyerProfileForm />;
}
