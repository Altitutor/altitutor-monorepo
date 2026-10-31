"use client";
import type { ComponentProps } from "react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@altitutor/ui";
export function EmailIconButton({
  label,
  className = "",
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`h-8 w-8 shrink-0 rounded-full ${className}`}
              aria-label={label}
              {...props}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
