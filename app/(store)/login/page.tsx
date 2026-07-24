import type { Metadata } from "next";
import { BuyerLoginForm } from "@/components/store/buyer-login-form";

export const metadata: Metadata = { title: { absolute: "Sign In · Aurora Market" } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/account";
  return <BuyerLoginForm redirectTo={redirectTo} />;
}
