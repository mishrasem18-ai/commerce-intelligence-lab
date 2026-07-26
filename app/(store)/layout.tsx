import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { AnalyticsRuntime } from "@/components/analytics/analytics-runtime";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
      {/* Page views, consent UI and the training debugger (renders no UI inline). */}
      <AnalyticsRuntime />
    </div>
  );
}
