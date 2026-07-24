import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { NotificationsList } from "@/components/dashboard/notifications-list";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity"
        description="A log of recent events and notifications across your workspace."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed />
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
