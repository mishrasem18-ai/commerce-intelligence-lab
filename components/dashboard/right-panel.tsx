import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TodaySummary } from "@/components/dashboard/today-summary";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { NotificationsList } from "@/components/dashboard/notifications-list";

export function RightPanel() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <TodaySummary />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Activity</CardTitle>
          <Link
            href="/admin/activity"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <ActivityFeed />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsList />
        </CardContent>
      </Card>
    </div>
  );
}
