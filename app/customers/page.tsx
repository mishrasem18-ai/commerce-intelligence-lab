import type { Metadata } from "next";
import { Crown, Repeat, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/cards/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomersTable } from "@/components/tables/customers-table";
import { customers } from "@/lib/data";
import { formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  const vip = customers.filter((c) => c.status === "VIP").length;
  const newCustomers = customers.filter((c) => c.status === "New").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Understand who buys from you and how they engage over time."
        actions={
          <Button>
            <UserPlus />
            Add Customer
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Customers"
          value={formatNumber(1876)}
          icon={Users}
          delta="+5.2%"
          direction="up"
        />
        <StatCard
          label="Returning Rate"
          value={formatPercent(0.42)}
          icon={Repeat}
          delta="+1.8%"
          direction="up"
        />
        <StatCard
          label="New This Month"
          value={formatNumber(214)}
          icon={UserPlus}
          delta="+9.4%"
          direction="up"
        />
        <StatCard
          label="VIP Customers"
          value={formatNumber(96)}
          icon={Crown}
          hint={`${vip} shown · ${newCustomers} new in list`}
        />
      </div>

      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All Customers</CardTitle>
          <div className="w-full sm:max-w-xs">
            <Input placeholder="Search customers…" />
          </div>
        </CardHeader>
        <CardContent>
          <CustomersTable customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
