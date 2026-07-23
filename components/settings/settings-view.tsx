"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Bell,
  Check,
  CreditCard,
  Monitor,
  Moon,
  Palette,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

type TabId = "profile" | "notifications" | "appearance" | "billing";

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export function SettingsView() {
  const [tab, setTab] = React.useState<TabId>("profile");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      {/* Tab rail */}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div>
        {tab === "profile" && <ProfileSettings />}
        {tab === "notifications" && <NotificationSettings />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "billing" && <BillingSettings />}
      </div>
    </div>
  );
}

function ProfileSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Update your personal details and workspace identity.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar name="Anurag Mishra" size="lg" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Upload
            </Button>
            <Button variant="ghost" size="sm">
              Remove
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" defaultValue="Anurag Mishra" />
          <Field label="Email" defaultValue="anurag@commercelab.io" type="email" />
          <Field label="Role" defaultValue="Workspace Admin" />
          <Field label="Timezone" defaultValue="GMT+05:30 (IST)" />
        </div>
        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button>Save changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const rows = [
    { key: "orders", title: "New orders", desc: "Get notified when an order is placed.", default: true },
    { key: "refunds", title: "Refunds & disputes", desc: "Alerts for refunds and chargebacks.", default: true },
    { key: "inventory", title: "Low inventory", desc: "When a product drops below threshold.", default: true },
    { key: "digest", title: "Weekly digest", desc: "A summary of performance every Monday.", default: false },
    { key: "product", title: "Product updates", desc: "News about new platform features.", default: false },
  ];
  const [state, setState] = React.useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.default])),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Choose what updates you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.desc}</p>
            </div>
            <Switch
              checked={state[row.key]}
              onCheckedChange={(checked) =>
                setState((prev) => ({ ...prev, [row.key]: checked }))
              }
              aria-label={row.title}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const options: Array<{ value: string; label: string; icon: LucideIcon }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how Commerce Intelligence Lab looks on your device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm font-medium text-foreground">Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {options.map((option) => {
            const Icon = option.icon;
            const active = mounted && theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <Icon className="size-5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function BillingSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>
          Manage your subscription and payment method.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Growth Plan</p>
              <Badge variant="default">Current</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              $99 / month · renews Aug 1, 2026
            </p>
          </div>
          <Button variant="outline" size="sm">
            Change plan
          </Button>
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            Payment method
          </p>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Visa ending 4242
                </p>
                <p className="text-xs text-muted-foreground">Expires 08/28</p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              Update
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}
