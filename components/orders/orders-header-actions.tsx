"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useOrders } from "@/lib/store/orders-store";
import { downloadCsv } from "@/lib/export-csv";
import type { Order } from "@/lib/data";

const CSV_COLUMNS = [
  { header: "Order", value: (o: Order) => o.id },
  { header: "Customer", value: (o: Order) => o.customer },
  { header: "Email", value: (o: Order) => o.email },
  { header: "Country", value: (o: Order) => o.country },
  { header: "Amount", value: (o: Order) => o.amount },
  { header: "Status", value: (o: Order) => o.status },
  { header: "Date", value: (o: Order) => o.date },
  { header: "Items", value: (o: Order) => o.items },
];

export function OrdersHeaderActions() {
  const { orders } = useOrders();
  const { toast } = useToast();

  const handleExport = () => {
    downloadCsv("orders", orders, CSV_COLUMNS);
    toast({
      variant: "success",
      title: "Export ready",
      description: `${orders.length} orders exported to CSV.`,
    });
  };

  return (
    <Button variant="outline" onClick={handleExport}>
      <Download />
      Export CSV
    </Button>
  );
}
