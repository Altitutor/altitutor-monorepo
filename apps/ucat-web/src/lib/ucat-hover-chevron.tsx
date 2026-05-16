"use client";

import { ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type UcatHoverChevronProps = {
  className?: string;
};

/** Chevron revealed on `group-hover` — matches dashboard nav tiles. */
export function UcatHoverChevron({ className }: UcatHoverChevronProps) {
  const reduceMotion = useReducedMotion();
  return (
    <ChevronRight
      className={cn(
        "h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-foreground",
        !reduceMotion && "translate-x-0 group-hover:translate-x-0.5",
        className,
      )}
      aria-hidden
    />
  );
}
