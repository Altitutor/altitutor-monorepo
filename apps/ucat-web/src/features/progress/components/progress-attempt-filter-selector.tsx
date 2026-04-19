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
        triggerClassName="w-[220px]"
      />
      {selectedOption && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex text-muted-foreground hover:text-foreground cursor-help">
                <Info className="h-3.5 w-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="z-[100] max-w-[260px]">
              {selectedOption.infoTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
