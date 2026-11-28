"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@altitutor/ui";
import { Check } from "lucide-react";
import { SessionsCard } from "./SessionsCard";

export type SessionDayItem = {
  id: string;
  label: string;
  startsAt?: string | null;
  sessionType?: string | null;
  description?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  select?: () => void;
};

export function SessionDay({
  items,
  timezone,
  view = "chips",
  emptyMessage = "No sessions on this day",
}: {
  items: readonly SessionDayItem[];
  timezone: string;
  view?: "cards" | "chips";
  emptyMessage?: string;
}) {
  if (!items.length) {
    return emptyMessage ? <p className="py-3 text-center text-xs text-muted-foreground">{emptyMessage}</p> : null;
  }
  const timeFormatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const groups = new Map<string, SessionDayItem[]>();
  const chronological = items
    .map(item => ({ item, timestamp: item.startsAt?.includes("T") ? Date.parse(item.startsAt) : NaN }))
    .sort((a, b) => (Number.isNaN(a.timestamp) ? 0 : a.timestamp) - (Number.isNaN(b.timestamp) ? 0 : b.timestamp));
  for (const { item, timestamp } of chronological) {
    const key = Number.isNaN(timestamp) ? "" : timeFormatter.format(timestamp);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return (
    <div className="space-y-2">
      {[...groups].map(([time, group]) => (
        <div key={time}>
          {time ? <p className="mb-1 text-xs tabular-nums text-muted-foreground">{time}</p> : null}
          <ul className={cn(view === "cards" ? "space-y-1" : "flex flex-wrap gap-1")}>
            {group.map((item) => {
              const selected = Boolean(item.selected);
              const pillClassName = cn(
                "inline-flex min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-left text-xs",
                selected && "border-foreground/30 bg-muted",
              );
              const choice = view === "cards" ? (
                <div
                  role="button"
                  aria-label={item.label}
                  aria-pressed={selected}
                  aria-disabled={item.disabled || undefined}
                  tabIndex={item.disabled ? -1 : 0}
                  onClick={item.disabled ? undefined : item.select}
                  onKeyDown={(event) => {
                    if (item.disabled || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    event.stopPropagation();
                    item.select?.();
                  }}
                  className={cn(
                    "relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    item.disabled && "opacity-50",
                  )}
                >
                  <SessionsCard
                    session={{ id: item.id, type: item.sessionType }}
                    title={item.label}
                    isSelecting
                    isSelected={selected}
                    compact
                  />
                  {selected ? <Check className="absolute right-1 top-1 size-3" aria-hidden /> : null}
                </div>
              ) : item.select ? (
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={item.disabled}
                  onClick={item.select}
                  className={cn(pillClassName, "hover:bg-muted disabled:opacity-50")}
                >
                  <span className="min-w-0 break-words">{item.label}</span>
                  {selected ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                </button>
              ) : (
                <span className={pillClassName}>{item.label}</span>
              );
              return (
                <li key={item.id} className="min-w-0">
                  {item.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{choice}</TooltipTrigger>
                      <TooltipContent className="max-w-72">{item.description}</TooltipContent>
                    </Tooltip>
                  ) : choice}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
