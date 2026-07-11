"use client";

import { Button } from "@/components/ui/button";
import { UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type ProgressClearFilterButtonProps = {
  onClick: () => void;
};

/** Outline control to reset a progress date-range filter to all time. */
export function ProgressClearFilterButton({
  onClick,
}: ProgressClearFilterButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        UCAT_SURFACE_MOTION,
        "border-border px-3 shadow-sm hover:bg-muted/55 hover:shadow-md active:scale-[0.98]",
      )}
    >
      Clear filter
    </Button>
  );
}
