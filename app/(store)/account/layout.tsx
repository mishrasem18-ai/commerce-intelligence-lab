import { redirect } from "next/navigation";
import { AccountShell } from "@/components/store/account-shell";
import { currentBuyerSession } from "@/lib/auth/guards";

// Auth authority is the server: validate the buyer session against D1 before
// rendering any account page. A forged/expired cookie (or a user that does not
// exist in D1) is redirected to login.
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentBuyerSession())) redirect("/login?redirect=/account");
  return <AccountShell>{children}</AccountShell>;
}
