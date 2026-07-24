"use client";

import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DateRangeSelect } from "@/components/dashboard/date-range-select";
import { downloadCsv } from "@/lib/export-csv";
import { monthlySeries, type MonthlyPoint } from "@/lib/data";

const RANGE_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

const CSV_COLUMNS = [
  { header: "Month", value: (m: MonthlyPoint) => m.month },
  { header: "Revenue", value: (m: MonthlyPoint) => m.revenue },
  { header: "Orders", value: (m: MonthlyPoint) => m.orders },
  { header: "Profit", value: (m: MonthlyPoint) => m.profit },
];

export function DashboardHeaderActions() {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <>
      <DateRangeSelect options={RANGE_OPTIONS} defaultValue="30d" className="w-40" />
      <Button
        variant="outline"
        onClick={() => {
          downloadCsv("dashboard-summary", monthlySeries, CSV_COLUMNS);
          toast({
            variant: "success",
            title: "Export ready",
            description: "Monthly performance exported to CSV.",
          });
        }}
      >
        <Download />
        Export
      </Button>
      <Button onClick={() => router.push("/admin/reports")}>
        <Plus />
        New Report
      </Button>
    </>
  );
}
