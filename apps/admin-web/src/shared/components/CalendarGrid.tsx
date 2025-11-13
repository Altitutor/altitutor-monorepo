'use client';

import { useMemo } from 'react';
import { Card } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { format } from 'date-fns';
import { isSameDay } from 'date-fns';

export interface CalendarDay {
  /** Unique identifier for the day (e.g., day_of_week number or date string) */
  value: string | number;
  /** Display label for the day header */
  label: string;
  /** Optional date object for date-based calendars */
  date?: Date;
}

export interface EventPosition {
  top: number;
  height: number;
  left: number;
  width: number;
  overlapIndex: number;
  totalOverlaps: number;
}

export interface CalendarGridProps<TEvent = unknown> {
  /** Array of days to display as columns */
  days: CalendarDay[];
  /** Array of events to render */
  events: TEvent[];
  /** Function to extract start time from event (returns minutes from start of day or Date) */
  getEventStart: (event: TEvent) => number | Date;
  /** Function to extract end time from event (returns minutes from start of day or Date) */
  getEventEnd: (event: TEvent) => number | Date;
  /** Function to determine which day an event belongs to */
  getEventDay: (event: TEvent) => string | number;
  /** Function to render an event block */
  renderEvent: (event: TEvent, position: EventPosition) => React.ReactNode;
  /** Time range to display (default: 9am-8pm) */
  timeRange?: { startHour: number; endHour: number };
  /** Height of each hour slot in pixels (default: 60) */
  slotHeight?: number;
  /** Show current time indicator line */
  showCurrentTimeIndicator?: boolean;
  /** Date to use for current time indicator (defaults to now) */
  currentTimeDate?: Date;
  /** Function to get className for day header cells */
  dayHeaderClassName?: (day: CalendarDay) => string;
  /** Function to get className for day cells */
  dayCellClassName?: (day: CalendarDay) => string;
  /** Custom empty state component */
  emptyState?: React.ReactNode;
  /** Time column width (default: 'minmax(80px, 120px)') */
  timeColumnWidth?: string;
  /** Day column width (default: 'minmax(200px, 1fr)') */
  dayColumnWidth?: string;
}

/**
 * Generic calendar grid component for displaying events in a weekly timetable format.
 * Handles overlap detection, positioning, and rendering of events.
 */
export function CalendarGrid<TEvent = unknown>({
  days,
  events,
  getEventStart,
  getEventEnd,
  getEventDay,
  renderEvent,
  timeRange = { startHour: 9, endHour: 20 },
  slotHeight = 60,
  showCurrentTimeIndicator = false,
  currentTimeDate,
  dayHeaderClassName,
  dayCellClassName,
  emptyState,
  timeColumnWidth = 'minmax(80px, 120px)',
  dayColumnWidth = 'minmax(200px, 1fr)',
}: CalendarGridProps<TEvent>) {
  const { startHour, endHour } = timeRange;
  const now = currentTimeDate || new Date();

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots: Array<{ hour: number; label: string }> = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const label = `${displayHour}:00 ${ampm}`;
      slots.push({ hour, label });
    }
    return slots;
  }, [startHour, endHour]);

  // Convert time to minutes from start of day
  const timeToMinutes = (time: number | Date): number => {
    if (time instanceof Date) {
      return time.getHours() * 60 + time.getMinutes();
    }
    return time;
  };

  // Calculate minutes from the start of the calendar (startHour)
  const minutesFromCalendarStart = (minutes: number): number => {
    const calendarStartMinutes = startHour * 60;
    return minutes - calendarStartMinutes;
  };

  // Find overlapping events for a specific day
  const findOverlappingEvents = (dayEvents: TEvent[]): TEvent[][] => {
    const groups: TEvent[][] = [];
    const processed = new Set<string | number>();

    dayEvents.forEach((event) => {
      const eventId = getEventDay(event);
      if (processed.has(eventId)) return;

      const group = [event];
      processed.add(eventId);

      const eventStart = timeToMinutes(getEventStart(event));
      const eventEnd = timeToMinutes(getEventEnd(event));

      dayEvents.forEach((otherEvent) => {
        const otherId = getEventDay(otherEvent);
        if (processed.has(otherId)) return;

        const otherStart = timeToMinutes(getEventStart(otherEvent));
        const otherEnd = timeToMinutes(getEventEnd(otherEvent));

        // Check if events overlap
        if (eventStart < otherEnd && eventEnd > otherStart) {
          group.push(otherEvent);
          processed.add(otherId);
        }
      });

      groups.push(group);
    });

    return groups;
  };

  // Calculate position of an event block
  const calculateEventPosition = (
    event: TEvent,
    overlappingEvents: TEvent[]
  ): EventPosition => {
    const startMinutes = timeToMinutes(getEventStart(event));
    const endMinutes = timeToMinutes(getEventEnd(event));
    const duration = endMinutes - startMinutes;

    const minutesFromStart = minutesFromCalendarStart(startMinutes);
    const top = Math.max(0, (minutesFromStart / 60) * slotHeight);
    const height = Math.max((duration / 60) * slotHeight, 30); // Minimum 30px height

    // Calculate overlapping positions
    const overlapIndex = overlappingEvents.findIndex(
      (e) => getEventDay(e) === getEventDay(event)
    );
    const totalOverlaps = overlappingEvents.length;
    const columnWidth = totalOverlaps > 1 ? 95 / totalOverlaps : 95; // Leave some margin
    const left = overlapIndex * columnWidth + 2.5; // Add small left margin

    return {
      top,
      height,
      left,
      width: columnWidth,
      overlapIndex,
      totalOverlaps,
    };
  };

  // Get events for a specific day
  const getEventsForDay = (dayValue: string | number): Array<{ event: TEvent; position: EventPosition }> => {
    const dayEvents = events
      .filter((event) => getEventDay(event) === dayValue)
      .sort((a, b) => {
        const aStart = timeToMinutes(getEventStart(a));
        const bStart = timeToMinutes(getEventStart(b));
        return aStart - bStart;
      });

    const overlapGroups = findOverlappingEvents(dayEvents);
    const positions: Array<{ event: TEvent; position: EventPosition }> = [];

    overlapGroups.forEach((group) => {
      group.forEach((event) => {
        const position = calculateEventPosition(event, group);
        positions.push({ event, position });
      });
    });

    return positions;
  };

  // Calculate current time indicator position
  const getCurrentTimeIndicator = () => {
    if (!showCurrentTimeIndicator) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minutesFromStart = minutesFromCalendarStart(currentMinutes);
    const top = (minutesFromStart / 60) * slotHeight;

    // Check if current time is within visible range
    if (top < 0 || top > timeSlots.length * slotHeight) return null;

    return top;
  };

  const currentTimeTop = getCurrentTimeIndicator();
  const todayDayIndex = days.findIndex((day) => day.date && isSameDay(day.date, now));

  // Default empty state
  const defaultEmptyState = (
    <div className="flex items-center justify-center h-full">
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No events found</p>
      </Card>
    </div>
  );

  if (days.length === 0) {
    return <>{emptyState || defaultEmptyState}</>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div
          className="grid gap-0 min-h-full relative bg-background"
          style={{
            gridTemplateColumns: `${timeColumnWidth} repeat(${days.length}, ${dayColumnWidth})`,
          }}
        >
          {/* Headers */}
          <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r">
            Time
          </div>

          {days.map((day) => (
            <div
              key={String(day.value)}
              className={cn(
                'sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r',
                dayHeaderClassName?.(day)
              )}
            >
              {day.label}
            </div>
          ))}

          {/* Time slots and day columns */}
          {timeSlots.map((timeSlot, timeIndex) => (
            <div key={timeSlot.hour} className="contents">
              {/* Time label */}
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[60px] flex items-center justify-center">
                {timeSlot.label}
              </div>

              {/* Day columns */}
              {days.map((day) => {
                const isToday = day.date && isSameDay(day.date, now);
                const dayEvents = getEventsForDay(day.value);

                return (
                  <div
                    key={`${day.value}-${timeSlot.hour}`}
                    className={cn(
                      'relative border-b border-r h-[60px]',
                      dayCellClassName?.(day) || 'bg-background'
                    )}
                  >
                    {/* Only render events in the first time slot to avoid duplicates */}
                    {timeIndex === 0 && (
                      <div
                        className="absolute inset-0"
                        style={{ height: `${timeSlots.length * slotHeight}px` }}
                      >
                        {/* Current time indicator */}
                        {isToday && currentTimeTop !== null && (
                          <div
                            className="absolute left-0 right-0 z-30 pointer-events-none"
                            style={{ top: `${currentTimeTop}px` }}
                          >
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                              <div className="flex-1 h-0.5 bg-red-500" />
                            </div>
                          </div>
                        )}

                        {/* Render events */}
                        {dayEvents.map(({ event, position }) => (
                          <div
                            key={String(getEventDay(event))}
                            style={{
                              top: `${position.top}px`,
                              height: `${Math.max(position.height, 45)}px`,
                              left: `${position.left}%`,
                              width: `${position.width}%`,
                              zIndex: 15,
                              minHeight: '45px',
                            }}
                          >
                            {renderEvent(event, position)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

