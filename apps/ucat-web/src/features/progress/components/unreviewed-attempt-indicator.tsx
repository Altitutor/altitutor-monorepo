"use client";

import React, { type ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";

export function UnreviewedAttemptDot() {
  return (
    <span
      className="size-2 shrink-0 rounded-full bg-amber-500 shadow-sm ring-2 ring-background"
      aria-hidden
    />
  );
}

export function UnreviewedAttemptTooltip({
  children,
}: {
  children: ReactElement;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="z-[100]">
          This attempt is unreviewed.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
