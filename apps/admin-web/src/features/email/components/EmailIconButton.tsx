"use client";
import type { ComponentProps } from "react";
import {
  Button,
  KeyboardShortcut,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@altitutor/ui";
export function EmailIconButton({
  label,
  shortcut,
  destructive = false,
  className = "",
  ...props
}: ComponentProps<typeof Button> & {
  label: string;
  shortcut?: string | string[];
  destructive?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`h-8 w-8 shrink-0 rounded-full ${destructive ? "!text-destructive hover:!text-destructive hover:!bg-destructive/10" : ""} ${className}`}
              aria-label={label}
              aria-keyshortcuts={
                shortcut
                  ? Array.isArray(shortcut)
                    ? shortcut.join("+")
                    : shortcut
                  : undefined
              }
              {...props}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          {label}
          {shortcut && (
            <KeyboardShortcut
              keys={Array.isArray(shortcut) ? shortcut : [shortcut]}
            />
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
