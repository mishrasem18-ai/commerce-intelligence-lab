import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsView } from "@/components/reports/reports-view";

export const metadata: Metadata = routeMetadata("admin_reports");

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Generate, schedule and download commerce reports for your team."
      />
      <ReportsView />
    </div>
  );
}
