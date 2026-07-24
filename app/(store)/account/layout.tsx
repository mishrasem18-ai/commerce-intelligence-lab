import { BuyerGuard } from "@/components/store/buyer-guard";
import { AccountShell } from "@/components/store/account-shell";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <BuyerGuard>
      <AccountShell>{children}</AccountShell>
    </BuyerGuard>
  );
}
