"use client";
import type { ComponentProps } from "react";
import { SearchableSelect, SearchableSelectFieldTrigger } from "@altitutor/ui";
import { cn } from "@/shared/utils";
import {
  getPriorityIcon,
  getPriorityLabel,
  getPriorityIconColor,
  PRIORITY_OPTIONS,
  type EntityPriority,
} from "@/shared/constants";

export function PrioritySelect({
  value,
  onValueChange,
  ...triggerProps
}: {
  value: number;
  onValueChange: (priority: EntityPriority) => void;
} & Omit<ComponentProps<"button">, "value">) {
  const priorityValue = (
    PRIORITY_OPTIONS.find((o) => o.value === value) ?? PRIORITY_OPTIONS[0]
  ).value;
  const PriorityIcon = getPriorityIcon(priorityValue);
  const displayValue = getPriorityLabel(priorityValue);
  const iconColor = getPriorityIconColor(priorityValue);
  const selectedOpt =
    PRIORITY_OPTIONS.find((o) => o.value === priorityValue) ??
    PRIORITY_OPTIONS[0];

  return (
    <SearchableSelect<(typeof PRIORITY_OPTIONS)[number]>
      items={PRIORITY_OPTIONS}
      value={selectedOpt}
      onValueChange={(opt) => opt && onValueChange(opt.value)}
      getItemId={(o) => String(o.value)}
      getItemLabel={(o) => o.label}
      fullWidth
      placeholder="Priority"
      searchPlaceholder="Search priority..."
      emptyMessage="No options found"
      trigger={
        <SearchableSelectFieldTrigger {...triggerProps}>
          <PriorityIcon className={cn("h-4 w-4", iconColor)} />
          <span className={cn(priorityValue === 0 && "text-muted-foreground")}>
            {displayValue}
          </span>
        </SearchableSelectFieldTrigger>
      }
      renderItem={(opt) => {
        const OptionIcon = getPriorityIcon(opt.value);
        const optionColor = getPriorityIconColor(opt.value);
        return (
          <div className="flex items-center gap-2">
            <OptionIcon className={cn("h-4 w-4", optionColor)} />
            <span>{opt.label}</span>
          </div>
        );
      }}
    />
  );
}
