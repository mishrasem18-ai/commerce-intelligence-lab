import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { BuyerLoginForm } from "@/components/store/buyer-login-form";

export const metadata: Metadata = routeMetadata("login");

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/account";
  return <BuyerLoginForm redirectTo={redirectTo} />;
}
