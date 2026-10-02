"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  navActiveStyles,
  navHoverStyles,
  navItemTransitionStyles,
} from "@altitutor/ui";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/shared/utils";
import { useAccessoryPanel } from "@/shared/contexts/AccessoryPanelContext";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DashboardDatePicker() {
  const panel = useAccessoryPanel();
  const [isOpen, setIsOpen] = useState(false);
  const calendarTab =
    panel?.tabs.find(
      (tab) => tab.kind === "today" && tab.key === panel.activeKey,
    ) ?? panel?.tabs.find((tab) => tab.kind === "today");
  const selectedDate = new URLSearchParams(calendarTab?.query).get("date");
  const activeDate =
    selectedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) &&
    isValid(parseISO(selectedDate))
      ? parseISO(selectedDate)
      : new Date();
  const [month, setMonth] = useState(() => startOfMonth(activeDate));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const activeDateStr = format(activeDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const selectDay = (day: Date) => {
    const date = format(day, "yyyy-MM-dd");
    const destination = {
      kind: "today" as const,
      title: date === todayStr ? "Today" : format(day, "d MMM"),
      query: date === todayStr ? "" : new URLSearchParams({ date }).toString(),
    };
    if (calendarTab && panel) {
      panel.navigateTab(calendarTab.key, destination);
      panel.selectTab(calendarTab.key);
    } else {
      panel?.openTab(destination);
    }
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) setMonth(startOfMonth(activeDate));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Open calendar"
          className="h-9 gap-2 px-2 md:px-3"
        >
          <CalendarDays className="h-4 w-4" />
          <span className="hidden md:inline text-sm">
            {format(activeDate, "dd/MM/yyyy")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] max-w-[calc(100vw-2rem)] p-3"
        collisionPadding={16}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => setMonth((previous) => addMonths(previous, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium" aria-live="polite">
            {format(month, "MMMM yyyy")}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            onClick={() => setMonth((previous) => addMonths(previous, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1" aria-hidden="true">
          {weekdays.map((day) => (
            <div
              key={day}
              className="text-center text-xs text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 gap-1"
          role="group"
          aria-label={format(month, "MMMM yyyy")}
        >
          {days.map((day) => {
            const date = format(day, "yyyy-MM-dd");
            if (!isSameMonth(day, month))
              return (
                <div
                  key={date}
                  aria-hidden="true"
                  className="aspect-square rounded-md bg-muted/20"
                />
              );
            const selected = date === activeDateStr;
            return (
              <button
                key={date}
                type="button"
                aria-label={format(day, "EEEE, d MMMM yyyy")}
                aria-pressed={selected}
                aria-current={date === todayStr ? "date" : undefined}
                onClick={() => selectDay(day)}
                className={cn(
                  "aspect-square min-w-0 rounded-md border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  navItemTransitionStyles,
                  selected ? navActiveStyles : navHoverStyles,
                  date === todayStr && "font-semibold ring-1 ring-border",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
