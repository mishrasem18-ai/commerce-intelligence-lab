import type { Metadata } from "next";
import {
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Table2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reports, type Report } from "@/lib/data";

export const metadata: Metadata = { title: "Reports" };

const formatIcon = {
  PDF: FileText,
  CSV: Table2,
  XLSX: FileSpreadsheet,
};

const statusVariant: Record<Report["status"], BadgeProps["variant"]> = {
  Ready: "success",
  Scheduled: "neutral",
  Generating: "warning",
};

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Generate, schedule and download commerce reports for your team."
        actions={
          <Button>
            <Plus />
            New Report
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = formatIcon[report.format];
          const ready = report.status === "Ready";
          return (
            <Card key={report.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <CardTitle className="text-sm">{report.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {report.period} · {report.format}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant[report.status]}>
                  {report.status === "Generating" && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  {report.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    Updated {report.updated}
                  </span>
                  <Button
                    variant={ready ? "outline" : "ghost"}
                    size="sm"
                    disabled={!ready}
                  >
                    <Download />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
