"use client";

import * as React from "react";
import {
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Table2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { downloadCsv, type CsvColumn } from "@/lib/export-csv";
import {
  customers,
  monthlySeries,
  products as catalogProducts,
  reports as seedReports,
  type Report,
} from "@/lib/data";

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

/** Pick a real dataset to export based on the report's subject. */
function exportReport(report: Report) {
  const name = report.name.toLowerCase();
  if (name.includes("product")) {
    const columns: CsvColumn<(typeof catalogProducts)[number]>[] = [
      { header: "ID", value: (p) => p.id },
      { header: "Name", value: (p) => p.name },
      { header: "Category", value: (p) => p.category },
      { header: "Price", value: (p) => p.price },
      { header: "Units Sold", value: (p) => p.unitsSold },
      { header: "Revenue", value: (p) => p.revenue },
      { header: "Stock", value: (p) => p.stock },
    ];
    downloadCsv(report.name, catalogProducts, columns);
    return;
  }
  if (name.includes("customer") || name.includes("cohort")) {
    const columns: CsvColumn<(typeof customers)[number]>[] = [
      { header: "ID", value: (c) => c.id },
      { header: "Name", value: (c) => c.name },
      { header: "Email", value: (c) => c.email },
      { header: "Country", value: (c) => c.country },
      { header: "Orders", value: (c) => c.orders },
      { header: "Spent", value: (c) => c.spent },
      { header: "Status", value: (c) => c.status },
    ];
    downloadCsv(report.name, customers, columns);
    return;
  }
  const columns: CsvColumn<(typeof monthlySeries)[number]>[] = [
    { header: "Month", value: (m) => m.month },
    { header: "Revenue", value: (m) => m.revenue },
    { header: "Orders", value: (m) => m.orders },
    { header: "Profit", value: (m) => m.profit },
  ];
  downloadCsv(report.name, monthlySeries, columns);
}

export function ReportsView() {
  const { toast } = useToast();
  const [reports, setReports] = React.useState<Report[]>(seedReports);
  const [creating, setCreating] = React.useState(false);

  const handleDownload = (report: Report) => {
    exportReport(report);
    toast({
      variant: "success",
      title: "Download started",
      description: `${report.name} exported as CSV.`,
    });
  };

  const handleCreate = (draft: { name: string; format: Report["format"] }) => {
    const report: Report = {
      id: `R-${Date.now().toString(36)}`,
      name: draft.name,
      description: "Custom report generated from your commerce data.",
      period: "Jul 2026",
      updated: "just now",
      format: draft.format,
      status: "Ready",
    };
    setReports((prev) => [report, ...prev]);
    setCreating(false);
    toast({
      variant: "success",
      title: "Report created",
      description: `${report.name} is ready to download.`,
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus />
          New Report
        </Button>
      </div>

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
                <p className="text-sm text-muted-foreground">{report.description}</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    Updated {report.updated}
                  </span>
                  <Button
                    variant={ready ? "outline" : "ghost"}
                    size="sm"
                    disabled={!ready}
                    onClick={() => handleDownload(report)}
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

      {creating && (
        <NewReportDialog onClose={() => setCreating(false)} onCreate={handleCreate} />
      )}
    </>
  );
}

function NewReportDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: { name: string; format: Report["format"] }) => void;
}) {
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState<Report["format"]>("CSV");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Report name is required.");
      return;
    }
    onCreate({ name: name.trim(), format });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-report-title"
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md animate-pop rounded-2xl border border-border bg-card shadow-2xl shadow-black/20"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="new-report-title" className="text-base font-semibold tracking-tight">
            New report
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Report name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Monthly Revenue Summary"
              autoFocus
            />
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Format</label>
            <Select
              label="Report format"
              value={format}
              onValueChange={(v) => setFormat(v as Report["format"])}
              options={[
                { value: "CSV", label: "CSV" },
                { value: "PDF", label: "PDF" },
                { value: "XLSX", label: "XLSX" },
              ]}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create report</Button>
        </div>
      </form>
    </div>
  );
}
