"use client";

import { useState, type ReactNode } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { BUSINESS_TIMEZONE } from "@altitutor/shared";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type SearchableSelectProps,
} from "@altitutor/ui";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";

/** Shared session chooser. Callers retain their eligibility, timezone and query
 * rules; this renders the same week selection interaction everywhere. */
export type SessionSelectProps<T> = Pick<
  SearchableSelectProps<T>,
  | "items"
  | "value"
  | "onValueChange"
  | "getItemId"
  | "getItemLabel"
  | "placeholder"
  | "disabled"
  | "loading"
  | "getItemDisabled"
  | "emptyMessage"
  | "trigger"
  | "triggerClassName"
  | "ariaLabel"
  | "footer"
  | "align"
  | "open"
  | "onOpenChange"
  | "popoverContainer"
> & {
  getItemDescription?: (item: T) => ReactNode;
  getItemDate?: (item: T) => string | null;
  timezone?: string;
  selectedIds?: ReadonlySet<string>;
  onToggle?: (item: T) => void;
  onWeekChange?: (start: Date) => void;
  weekStart?: Date;
  minDate?: Date;
};

export function SessionSelect<T>({
  items,
  value,
  onValueChange,
  getItemId,
  getItemLabel,
  getItemDate,
  getItemDescription,
  timezone = BUSINESS_TIMEZONE,
  selectedIds,
  onToggle,
  onWeekChange,
  placeholder = "Select session",
  disabled,
  loading,
  getItemDisabled,
  emptyMessage = "No sessions this week",
  trigger,
  triggerClassName,
  ariaLabel,
  footer,
  weekStart,
  minDate,
  align = "start",
  open: controlledOpen,
  onOpenChange,
  popoverContainer,
}: SessionSelectProps<T>) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const calendarDate = (item: T): string | null => {
    const raw = getItemDate
      ? getItemDate(item)
      : item && typeof item === "object" && "start_at" in item
        ? item.start_at
        : item && typeof item === "object" && "value" in item
          ? item.value
          : getItemId(item);
    if (typeof raw !== "string" || !raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
  };
  const initialDate = value
    ? calendarDate(value)
    : items.length
      ? calendarDate(items[0])
      : null;
  const [localWeek, setWeek] = useState(() =>
    startOfWeek(
      initialDate ? new Date(`${initialDate}T12:00:00`) : new Date(),
      { weekStartsOn: 1 },
    ),
  );
  const week = weekStart ?? localWeek;
  const [day, setDay] = useState(0);
  const setOpen = (next: boolean) => {
    if (next && (disabled || loading)) return;
    if (next && !onWeekChange && !weekStart) {
      const dates = items
        .map(calendarDate)
        .filter((date): date is string => Boolean(date));
      const current = value ? calendarDate(value) : null;
      const candidate =
        current ??
        dates.find(
          (date) =>
            date >= format(week, "yyyy-MM-dd") &&
            date <= format(addDays(week, 6), "yyyy-MM-dd"),
        ) ??
        dates[0];
      if (candidate)
        setWeek(
          startOfWeek(new Date(`${candidate}T12:00:00`), { weekStartsOn: 1 }),
        );
    }
    setLocalOpen(next);
    onOpenChange?.(next);
    if (next) onWeekChange?.(week);
  };
  const moveWeek = (offset: number) => {
    const next = addDays(week, offset);
    setWeek(next);
    onWeekChange?.(next);
  };
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const choose = (item: T) => {
    if (onToggle) onToggle(item);
    else {
      onValueChange(item);
      setOpen(false);
    }
  };
  const renderDay = (index: number) => {
    const dateKey = format(days[index], "yyyy-MM-dd");
    const choices = items.filter((item) => calendarDate(item) === dateKey);
    return (
      <div className="space-y-2">
        {choices.map((item) => {
          const id = getItemId(item);
          const selected = selectedIds
            ? selectedIds.has(id)
            : value !== null && getItemId(value) === id;
          const label = getItemLabel(item);
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={getItemDisabled?.(item)}
                  onClick={() => choose(item)}
                  className={`w-full rounded-md border p-2 text-left text-xs hover:bg-muted disabled:opacity-50 ${selected ? "border-foreground/30 bg-muted" : "bg-background"}`}
                >
                  <span className="flex items-start justify-between gap-1">
                    <span className="break-words">{label}</span>
                    {selected && <Check className="h-3 w-3 shrink-0" />}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                {getItemDescription ? (
                  getItemDescription(item)
                ) : (
                  <div className="space-y-1">
                    <p>{label}</p>
                    {item &&
                      typeof item === "object" &&
                      "start_at" in item &&
                      typeof item.start_at === "string" &&
                      !Number.isNaN(new Date(item.start_at).getTime()) && (
                        <p>
                          {new Date(item.start_at).toLocaleString("en-AU", {
                            timeZone: timezone,
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                    {item &&
                      typeof item === "object" &&
                      "room" in item &&
                      typeof item.room === "string" && <p>{item.room}</p>}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {!choices.length && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </div>
    );
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="field"
            role="combobox"
            aria-label={ariaLabel ?? placeholder}
            aria-expanded={open}
            disabled={disabled || loading}
            className={triggerClassName}
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {loading
                ? "Loading sessions…"
                : selectedIds?.size
                  ? `${selectedIds.size} sessions selected`
                  : value
                    ? getItemLabel(value)
                    : placeholder}
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        container={popoverContainer}
        align={align}
        className="w-[min(720px,calc(100vw-2rem))] p-3"
      >
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            disabled={Boolean(minDate && addDays(week, -7) < minDate)}
            onClick={() => moveWeek(-7)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <strong className="text-sm">
            {format(week, "d MMM")} – {format(addDays(week, 6), "d MMM yyyy")}
          </strong>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next week"
            onClick={() => moveWeek(7)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <TooltipProvider>
          <div className="hidden grid-cols-7 gap-2 md:grid">
            {days.map((date, index) => (
              <div
                key={date.toISOString()}
                className="min-h-44 min-w-0 space-y-2 border-r pr-1 last:border-0"
              >
                <p className="text-center text-xs font-medium">
                  {format(date, "EEE d")}
                </p>
                {renderDay(index)}
              </div>
            ))}
          </div>
          <div className="md:hidden">
            <div className="mb-3 grid grid-cols-7 gap-1">
              {days.map((date, index) => (
                <button
                  key={date.toISOString()}
                  type="button"
                  aria-pressed={day === index}
                  onClick={() => setDay(index)}
                  className={`rounded-md py-2 text-xs ${day === index ? "bg-muted font-semibold" : "hover:bg-muted/50"}`}
                >
                  {format(date, "EEE")}
                  <span className="block">{format(date, "d")}</span>
                </button>
              ))}
            </div>
            {renderDay(day)}
          </div>
        </TooltipProvider>
        {loading && (
          <p role="status" className="py-3 text-sm text-muted-foreground">
            Loading sessions…
          </p>
        )}
        {footer && <div className="mt-3 border-t pt-3">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
