"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";

export function DateRangeSelect({
  options,
  defaultValue,
  className,
}: {
  options: SelectOption[];
  defaultValue?: string;
  className?: string;
}) {
  const [value, setValue] = React.useState(defaultValue ?? options[0].value);

  return (
    <Select
      label="Date range"
      value={value}
      onValueChange={setValue}
      options={options}
      icon={<CalendarDays />}
      align="end"
      className={className}
    />
  );
}
