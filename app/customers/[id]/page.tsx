import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecentOrdersTable } from "@/components/tables/recent-orders-table";
import { customers, orders, type Customer } from "@/lib/data";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamicParams = false;

const statusVariant: Record<Customer["status"], BadgeProps["variant"]> = {
  VIP: "default",
  Active: "success",
  New: "neutral",
  "At Risk": "warning",
};

export function generateStaticParams() {
  return customers.map((customer) => ({ id: customer.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = customers.find((c) => c.id === id);
  return { title: customer ? customer.name : "Customer not found" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = customers.find((c) => c.id === id);

  if (!customer) notFound();

  const customerOrders = orders.filter((order) => order.customer === customer.name);
  const aov = customer.orders > 0 ? customer.spent / customer.orders : 0;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/customers" className="transition-colors hover:text-foreground">
          Customers
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{customer.name}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={customer.name} size="lg" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {customer.name}
              </h1>
              <Badge variant={statusVariant[customer.status]}>{customer.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{customer.email}</span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {customer.country}
              </span>
            </div>
          </div>
        </div>
        <a
          href={`mailto:${customer.email}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Mail />
          Email
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total Orders" value={formatNumber(customer.orders)} />
        <StatTile label="Total Spent" value={formatCurrency(customer.spent)} />
        <StatTile
          label="Avg. Order Value"
          value={formatCurrency(aov, { maximumFractionDigits: 2 })}
        />
        <StatTile label="Last Seen" value={customer.lastSeen} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {customerOrders.length > 0 ? (
            <RecentOrdersTable orders={customerOrders} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No orders recorded for this customer yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </Card>
  );
}
