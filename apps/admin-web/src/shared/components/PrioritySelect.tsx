"use client";
import type { ComponentProps } from "react";
import { Button, SearchableSelect, SearchableSelectFieldTrigger } from "@altitutor/ui";
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
  pill = false,
  ...triggerProps
}: {
  value: number;
  pill?: boolean;
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

  const triggerContent = (
    <>
      <PriorityIcon className={cn(pill ? "size-3" : "size-4", iconColor)} />
      <span className={cn(!pill && priorityValue === 0 && "text-muted-foreground")}>
        {displayValue}
      </span>
    </>
  );

  return (
    <SearchableSelect<(typeof PRIORITY_OPTIONS)[number]>
      items={PRIORITY_OPTIONS}
      value={selectedOpt}
      onValueChange={(opt) => opt && onValueChange(opt.value)}
      getItemId={(o) => String(o.value)}
      getItemLabel={(o) => o.label}
      fullWidth={!pill}
      placeholder="Priority"
      searchPlaceholder="Search priority..."
      emptyMessage="No options found"
      trigger={pill ? (
        <Button
          type="button"
          variant="outline"
          data-property-empty={priorityValue === 0 || undefined}
          {...triggerProps}
          className={cn("h-8 rounded-full px-3 text-xs", triggerProps.className)}
        >
          {triggerContent}
        </Button>
      ) : (
        <SearchableSelectFieldTrigger {...triggerProps}>
          {triggerContent}
        </SearchableSelectFieldTrigger>
      )}
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
