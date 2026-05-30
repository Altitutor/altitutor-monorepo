"use client";

import { Info } from "lucide-react";
import {
  UCAT_INTERACTION_EASE,
  UCAT_SEGMENTED_TAB,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";

type SegmentedControlOption<T> = {
  value: T;
  label: string;
  infoTooltip?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  className?: string;
};

const segmentTabPadding = [
  "inline-flex items-center gap-1.5 px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

/** Matches the set generator page tab selector style. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "inline-flex rounded-ucatControl border-0 bg-muted p-0.5 text-xs ring-1 ring-[hsl(0_0%_0%/0.04)] dark:ring-[hsl(0_0%_100%/0.06)]",
          "transition-[box-shadow,ring-color] duration-200",
          UCAT_INTERACTION_EASE,
          className,
        )}
        role="tablist"
      >
        {options.map((option) => {
          const isActive = value === option.value;

          if (option.infoTooltip) {
            return (
              <div
                key={option.value}
                className={cn(
                  "group inline-flex items-stretch overflow-hidden rounded-ucatControl",
                  isActive
                    ? "bg-card text-foreground shadow-sm ring-1 ring-[hsl(0_0%_0%/0.05)] dark:ring-[hsl(0_0%_100%/0.07)]"
                    : "text-foreground",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onValueChange(option.value)}
                  className={cn(
                    segmentTabPadding,
                    "rounded-l-md rounded-r-none",
                    !isActive && "hover:bg-muted/80",
                  )}
                >
                  {option.label}
                </button>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center justify-center rounded-r-md rounded-l-none border-l px-2 py-1.5",
                        "text-muted-foreground transition-[color,background-color] duration-200",
                        UCAT_INTERACTION_EASE,
                        "hover:text-foreground",
                        !isActive && "group-hover:bg-muted/80",
                        isActive
                          ? "border-foreground/12"
                          : "border-black/[0.06] dark:border-white/12",
                      )}
                      aria-label="About this option"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-3 w-3 shrink-0" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    {option.infoTooltip}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          }

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onValueChange(option.value)}
              className={cn(
                UCAT_SEGMENTED_TAB,
                isActive
                  ? "bg-card text-foreground shadow-sm ring-1 ring-[hsl(0_0%_0%/0.05)] dark:ring-[hsl(0_0%_100%/0.07)]"
                  : "text-foreground hover:bg-muted/80",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
