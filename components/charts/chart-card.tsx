import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Fixed height for the plotting area (charts need an explicit height). */
  height?: number;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  description,
  action,
  height,
  className,
  bodyClassName,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("flex-1", bodyClassName)}>
        <div style={height ? { height } : undefined} className="w-full">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
