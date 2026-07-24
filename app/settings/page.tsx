import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView, type SettingsTabId } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

const VALID_TABS: SettingsTabId[] = [
  "profile",
  "account",
  "workspace",
  "notifications",
  "appearance",
  "billing",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = VALID_TABS.find((t) => t === tab) ?? "profile";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your account, notifications and workspace preferences."
      />
      <SettingsView initialTab={initialTab} />
    </div>
  );
}
