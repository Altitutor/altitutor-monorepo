"use client";
import { Button, SearchableSelect } from "@altitutor/ui";
import { cn } from "@/shared/utils";
import {
  getPriorityIcon,
  getPriorityLabel,
  getPriorityIconColor,
  PRIORITY_OPTIONS,
  type EntityPriority,
} from "@/shared/constants";

type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

export function PriorityEntityPill({
  value,
  onChange,
  collapsed,
}: {
  value: number;
  onChange: (v: EntityPriority) => void;
  collapsed?: boolean;
}) {
  const selectedItem =
    PRIORITY_OPTIONS.find((o) => o.value === value) ?? PRIORITY_OPTIONS[0];
  const label = getPriorityLabel(selectedItem.value);
  const iconColor = getPriorityIconColor(selectedItem.value);
  const Icon = getPriorityIcon(selectedItem.value);
  const isEmpty = value === 0;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchableSelect<PriorityOption>
        items={PRIORITY_OPTIONS}
        value={selectedItem}
        onValueChange={(item) => onChange(item ? item.value : 0)}
        getItemLabel={(o) => o.label}
        getItemId={(o) => String(o.value)}
        trigger={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-8 border rounded-full bg-background group gap-1.5 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 dark:hover:text-white",
              collapsed ? "px-2 w-auto" : "px-3 text-xs w-auto",
            )}
          >
            <Icon
              className={cn(
                "h-3 w-3 flex-shrink-0",
                isEmpty
                  ? "text-muted-foreground opacity-40 group-hover:opacity-100"
                  : iconColor,
              )}
            />
            {!collapsed && (
              <span
                className={cn(
                  "truncate",
                  isEmpty &&
                    "text-muted-foreground opacity-40 group-hover:opacity-100",
                )}
              >
                {label}
              </span>
            )}
          </Button>
        }
      />
    </div>
  );
}
