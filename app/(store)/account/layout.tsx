import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/store/account-shell";
import { BUYER_COOKIE, getBuyerSession } from "@/lib/auth/session";

// Auth authority is the server: validate the buyer session against D1 before
// rendering any account page. A forged/expired cookie (or a user that does not
// exist in D1) is redirected to login.
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(BUYER_COOKIE)?.value;
  const session = token ? await getBuyerSession(token) : null;
  if (!session) redirect("/login?redirect=/account");
  return <AccountShell>{children}</AccountShell>;
}
