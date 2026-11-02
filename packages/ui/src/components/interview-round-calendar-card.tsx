"use client";
import { format } from "date-fns";

export function InterviewRoundCalendarCard({
  name,
  start,
  onClick,
}: {
  name: string;
  start: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Interview round ${name}`}
      className="h-full w-full overflow-hidden rounded-lg border border-violet-300 bg-violet-50 p-2 text-left shadow-sm dark:border-violet-700 dark:bg-violet-950/40"
    >
      <p className="truncate text-xs font-medium text-violet-700 dark:text-violet-200">
        Interview
      </p>
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {format(new Date(start), "h:mm a")}
      </p>
    </button>
  );
}
