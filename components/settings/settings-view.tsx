"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Bell,
  Building2,
  Check,
  CreditCard,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
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
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "profile"
  | "account"
  | "workspace"
  | "notifications"
  | "appearance"
  | "billing";

const tabs: Array<{ id: SettingsTabId; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "account", label: "Account", icon: ShieldCheck },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export function SettingsView({
  initialTab = "profile",
}: {
  initialTab?: SettingsTabId;
}) {
  const [tab, setTab] = React.useState<SettingsTabId>(initialTab);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
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
        {tab === "account" && <AccountSettings />}
        {tab === "workspace" && <WorkspaceSettings />}
        {tab === "notifications" && <NotificationSettings />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "billing" && <BillingSettings />}
      </div>
    </div>
  );
}

const DEFAULT_PROFILE = {
  name: "Anurag Mishra",
  email: "anurag@commercelab.io",
  role: "Workspace Admin",
  timezone: "GMT+05:30 (IST)",
};

function ProfileSettings() {
  const { toast } = useToast();
  const [values, setValues] = React.useState(DEFAULT_PROFILE);

  const set = (key: keyof typeof DEFAULT_PROFILE, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    toast({
      variant: "success",
      title: "Profile saved",
      description: "Your profile details have been updated.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Update your personal details and workspace identity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={values.name} size="lg" />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({
                    variant: "info",
                    title: "Not available",
                    description: "Avatar upload isn't available in this demo.",
                  })
                }
              >
                Upload
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  toast({ title: "Avatar removed", description: "Now using your initials." })
                }
              >
                Remove
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" value={values.name} onChange={(v) => set("name", v)} />
            <Field label="Email" type="email" value={values.email} onChange={(v) => set("email", v)} />
            <Field label="Role" value={values.role} onChange={(v) => set("role", v)} />
            <Field label="Timezone" value={values.timezone} onChange={(v) => set("timezone", v)} />
          </div>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setValues(DEFAULT_PROFILE)}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountSettings() {
  const { toast } = useToast();
  const [twoFactor, setTwoFactor] = React.useState(false);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    toast({
      variant: "success",
      title: "Account updated",
      description: "Your security settings have been saved.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account &amp; Security</CardTitle>
        <CardDescription>Manage your login and account security.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current password" type="password" placeholder="••••••••" />
            <Field label="New password" type="password" placeholder="••••••••" />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Two-factor authentication
              </p>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account.
              </p>
            </div>
            <Switch
              checked={twoFactor}
              onCheckedChange={setTwoFactor}
              aria-label="Two-factor authentication"
            />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function WorkspaceSettings() {
  const { toast } = useToast();
  const [name, setName] = React.useState("Commerce Intelligence Lab");
  const [currency, setCurrency] = React.useState("USD");
  const [timezone, setTimezone] = React.useState("Asia/Kolkata");

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    toast({
      variant: "success",
      title: "Workspace saved",
      description: "Workspace preferences have been updated.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Configure defaults for everyone in this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-6">
          <Field label="Workspace name" value={name} onChange={setName} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Default currency</label>
              <Select
                label="Default currency"
                value={currency}
                onValueChange={setCurrency}
                options={[
                  { value: "USD", label: "USD — US Dollar" },
                  { value: "EUR", label: "EUR — Euro" },
                  { value: "GBP", label: "GBP — British Pound" },
                  { value: "INR", label: "INR — Indian Rupee" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Timezone</label>
              <Select
                label="Timezone"
                value={timezone}
                onValueChange={setTimezone}
                options={[
                  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                  { value: "America/New_York", label: "America/New York (ET)" },
                  { value: "Europe/London", label: "Europe/London (GMT)" },
                  { value: "UTC", label: "UTC" },
                ]}
              />
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const { toast } = useToast();
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
        <CardDescription>Choose what updates you want to receive.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-4 py-4 first:pt-0"
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
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() =>
              toast({
                variant: "success",
                title: "Preferences saved",
                description: "Your notification settings have been updated.",
              })
            }
          >
            Save preferences
          </Button>
        </div>
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

const PLANS: Record<string, { label: string; price: string }> = {
  starter: { label: "Starter Plan", price: "$29 / month" },
  growth: { label: "Growth Plan", price: "$99 / month · renews Aug 1, 2026" },
  scale: { label: "Scale Plan", price: "$299 / month" },
};

function BillingSettings() {
  const { toast } = useToast();
  const [plan, setPlan] = React.useState("growth");
  const current = PLANS[plan];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and payment method.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{current.label}</p>
              <Badge variant="default">Current</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{current.price}</p>
          </div>
          <Select
            label="Change plan"
            value={plan}
            onValueChange={(value) => {
              setPlan(value);
              toast({
                variant: "success",
                title: "Plan updated",
                description: `Switched to the ${PLANS[value].label}.`,
              });
            }}
            options={Object.entries(PLANS).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            align="end"
            className="w-44"
          />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Payment method</p>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Visa ending 4242</p>
                <p className="text-xs text-muted-foreground">Expires 08/28</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                toast({
                  variant: "info",
                  title: "Not available",
                  description: "Payment method updates aren't available in this demo.",
                })
              }
            >
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
  value,
  onChange,
  ...props
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...props}
      />
    </div>
  );
}
