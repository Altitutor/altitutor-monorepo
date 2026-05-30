"use client";

import { Check, Info } from "lucide-react";
import {
  SearchableSelect,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { cn } from "@/lib/utils";
import {
  type AttemptFilter,
  ATTEMPT_FILTER_OPTIONS,
} from "../lib/progress-mode";

/** Matches trigger max width so the menu does not extend past the control */
const FILTER_SELECT_MAX = "min(calc(100vw - 2rem), 16rem)";

type ProgressAttemptFilterSelectorProps = {
  value: AttemptFilter;
  onValueChange: (value: AttemptFilter) => void;
  className?: string;
};

export function ProgressAttemptFilterSelector({
  value,
  onValueChange,
  className,
}: ProgressAttemptFilterSelectorProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn(className, "w-full max-w-[min(100%,16rem)]")}>
        <SearchableSelect<(typeof ATTEMPT_FILTER_OPTIONS)[number]>
          items={ATTEMPT_FILTER_OPTIONS}
          value={ATTEMPT_FILTER_OPTIONS.find((o) => o.value === value) ?? null}
          onValueChange={(item) => item && onValueChange(item.value)}
          getItemLabel={(o) => o.label}
          getItemId={(o) => o.value}
          placeholder="Filter"
          searchPlaceholder="Search filters…"
          triggerClassName="h-9 w-full min-w-0 font-normal"
          contentWidth={FILTER_SELECT_MAX}
          className="overflow-x-hidden"
          renderItem={(item, isSelected) => (
            <>
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSelected ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm",
                  isSelected && "font-medium",
                )}
              >
                {item.label}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About: ${item.label}`}
                    className={cn(
                      "shrink-0 rounded-sm p-1 text-muted-foreground outline-none",
                      "hover:bg-muted hover:text-foreground",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  align="center"
                  className="z-[200] max-w-[min(calc(100vw-2rem),20rem)] text-pretty"
                >
                  {item.infoTooltip}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        />
      </div>
    </TooltipProvider>
  );
}
