"use client";

import { ClipboardList } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type InterviewCalendarRange = {
  start: string;
  end: string;
  timeZone?: string;
};

export function formatInterviewCalendarRange({
  start,
  end,
  timeZone,
}: InterviewCalendarRange) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatRange(new Date(start), new Date(end));
}

export function InterviewRoundCalendarCard({
  name,
  onClick,
  tooltipRange,
}: {
  name: string;
  onClick: () => void;
  tooltipRange?: InterviewCalendarRange;
}) {
  const card = (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Interview round ${name}`}
      className="flex h-full w-full items-start gap-1.5 overflow-hidden rounded-lg bg-card p-1.5 text-left shadow-sm ring-1 ring-black/[0.06] hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:ring-white/10"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ClipboardList aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          Interview
        </span>
      </span>
    </button>
  );
  if (!tooltipRange) return card;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {formatInterviewCalendarRange(tooltipRange)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
