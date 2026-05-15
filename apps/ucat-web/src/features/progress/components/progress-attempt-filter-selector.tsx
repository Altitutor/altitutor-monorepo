"use client";

import { Info } from "lucide-react";
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
  const selectedOption = ATTEMPT_FILTER_OPTIONS.find((o) => o.value === value);

  return (
    <div className={cn(className, "flex items-center gap-1")}>
      <SearchableSelect<(typeof ATTEMPT_FILTER_OPTIONS)[number]>
        items={ATTEMPT_FILTER_OPTIONS}
        value={ATTEMPT_FILTER_OPTIONS.find((o) => o.value === value) ?? null}
        onValueChange={(item) => item && onValueChange(item.value)}
        getItemLabel={(o) => o.label}
        getItemId={(o) => o.value}
        placeholder="Filter"
        triggerClassName="w-[min(100%,17.5rem)] min-w-[12rem] sm:w-[17.5rem]"
      />
      {selectedOption && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-muted-foreground transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-foreground">
                <Info className="h-3.5 w-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="z-[100] max-w-[min(100vw-2rem,22rem)]">
              {selectedOption.infoTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
