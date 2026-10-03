"use client";
import { useEffect, useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { Button, SmartDatePickerPopover } from "@altitutor/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TodaySessionsCalendarView } from "@/features/sessions/components/TodaySessionsCalendarView";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";
import { useUrlQueryParam } from "@/shared/hooks/useUrlQueryParam";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";

export function TodayView() {
  const [today, setToday] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedDate, setSelectedDate] = useUrlQueryParam("date");
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && isValid(parseISO(selectedDate))
      ? selectedDate
      : today;
  const day = parseISO(date);
  const { openSession } = useEntityNavigation();
  useAccessoryTitle(date === today ? "Today" : format(day, "d MMM"));
  useEffect(() => {
    const refresh = () => setToday(format(new Date(), "yyyy-MM-dd"));
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const selectDay = (value: string | null) => {
    const dayValue = value?.split("T")[0] ?? today;
    setSelectedDate(dayValue === today ? "" : dayValue);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        data-pane-toolbar
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-2"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous day"
          onClick={() => selectDay(format(addDays(day, -1), "yyyy-MM-dd"))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <SmartDatePickerPopover
          value={date}
          onChange={selectDay}
          align="center"
        >
          <Button
            variant="ghost"
            aria-label="Choose calendar day"
            className="min-w-0 truncate"
          >
            {format(day, "EEEE, d MMMM")}
          </Button>
        </SmartDatePickerPopover>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next day"
          onClick={() => selectDay(format(addDays(day, 1), "yyyy-MM-dd"))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 pt-0">
        <TodaySessionsCalendarView date={date} onOpenSession={openSession} />
      </div>
    </div>
  );
}
