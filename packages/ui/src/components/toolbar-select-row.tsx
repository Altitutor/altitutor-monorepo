"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useRemountPersistentState } from "../hooks/use-remount-persistent-state";

/** Click-to-open selector inside the Display panel. */
export function ToolbarSelectRow({
  label,
  summary,
  children,
  persistenceKey,
  accessory,
}: {
  label: string;
  summary?: string;
  children: ReactNode;
  persistenceKey: string;
  accessory?: ReactNode;
}) {
  const summaryId = useId();
  const [open, setOpen] = useRemountPersistentState(persistenceKey, false);
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 py-1.5">
      <span className="min-w-0 text-sm text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {accessory}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Choose ${label}`}
              aria-describedby={summaryId}
              className="inline-flex h-8 w-44 shrink-0 items-center justify-between gap-2 rounded-md border bg-muted/50 px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span id={summaryId} className="truncate">
                {summary || "Select values…"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            className="w-[min(320px,90vw)] p-0"
          >
            {children}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
