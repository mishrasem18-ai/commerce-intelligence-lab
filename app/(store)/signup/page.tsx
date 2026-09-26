import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { BuyerSignupForm } from "@/components/store/buyer-signup-form";

export const metadata: Metadata = routeMetadata("signup");

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/account";
  return <BuyerSignupForm redirectTo={redirectTo} />;
}
