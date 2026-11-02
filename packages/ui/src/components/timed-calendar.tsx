"use client";

import React from "react";
import { format, isSameDay, startOfDay, addDays } from "date-fns";

export interface TimedCalendarEvent<T> {
  id: string;
  startAt: string;
  endAt: string;
  value: T;
}

/** Shared day/week grid: sessions and interviews participate in the same overlap groups. */
export function TimedCalendar<T>({
  dates,
  events,
  renderEvent,
}: {
  dates: Date[];
  events: TimedCalendarEvent<T>[];
  renderEvent: (
    value: T,
    size: { height: number; width: number },
  ) => React.ReactNode;
}) {
  const days = dates.map((date) => {
    const start = startOfDay(date).getTime();
    const end = addDays(startOfDay(date), 1).getTime();
    return {
      date,
      entries: events
        .flatMap((event) => {
          const from = Date.parse(event.startAt);
          const until = Date.parse(event.endAt);
          if (
            !Number.isFinite(from) ||
            !Number.isFinite(until) ||
            until <= from ||
            from >= end ||
            until <= start
          )
            return [];
          const clippedStart = new Date(Math.max(start, from));
          const clippedEnd = new Date(Math.min(end, until));
          return [
            {
              event,
              start: clippedStart.getHours() * 60 + clippedStart.getMinutes(),
              end:
                until >= end
                  ? 1440
                  : clippedEnd.getHours() * 60 + clippedEnd.getMinutes(),
            },
          ];
        })
        .sort((a, b) => a.start - b.start),
    };
  });
  const entries = days.flatMap((day) => day.entries);
  const startHour = entries.length
    ? Math.max(0, Math.floor(Math.min(...entries.map((e) => e.start)) / 60) - 1)
    : 9;
  const endHour = entries.length
    ? Math.min(24, Math.ceil(Math.max(...entries.map((e) => e.end)) / 60) + 1)
    : 21;
  const hours = Array.from(
    { length: Math.max(1, endHour - startHour) },
    (_, i) => startHour + i,
  );
  const now = new Date();
  const slotHeight = 75;
  return (
    <div className="relative overflow-auto">
      <div
        className="relative grid bg-background"
        style={{
          gridTemplateColumns: `minmax(80px, 100px) repeat(${dates.length}, minmax(150px, 1fr))`,
          minWidth: dates.length > 1 ? "max-content" : undefined,
        }}
      >
        <div className="sticky top-0 z-20 border-b border-r bg-background p-2 text-center text-xs font-medium">
          Time
        </div>
        {days.map(({ date }) => (
          <div
            key={date.toISOString()}
            className="sticky top-0 z-20 border-b border-r bg-background p-2 text-center text-sm font-medium"
          >
            {format(date, "EEE dd MMM")}
          </div>
        ))}
        {hours.map((hour, index) => (
          <React.Fragment key={hour}>
            <div className="sticky left-0 z-10 flex h-[75px] items-center justify-center border-b border-r bg-muted/30 text-sm">
              {format(new Date(2000, 0, 1, hour), "h a")}
            </div>
            {days.map(({ date, entries: dayEntries }) => (
              <div
                key={date.toISOString()}
                className="relative h-[75px] border-b border-r"
              >
                {index === 0 && (
                  <div
                    className="absolute inset-0"
                    style={{ height: hours.length * slotHeight }}
                  >
                    {isSameDay(date, now) &&
                      now.getHours() >= startHour &&
                      now.getHours() < endHour && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-30 h-0.5 bg-red-500"
                          style={{
                            top:
                              ((now.getHours() * 60 +
                                now.getMinutes() -
                                startHour * 60) /
                                60) *
                              slotHeight,
                          }}
                        />
                      )}
                    {(() => {
                      const groups: (typeof dayEntries)[] = [];
                      let groupEnd = -Infinity;
                      for (const entry of dayEntries) {
                        if (entry.start >= groupEnd) {
                          groups.push([entry]);
                          groupEnd = entry.end;
                        } else {
                          groups[groups.length - 1].push(entry);
                          groupEnd = Math.max(groupEnd, entry.end);
                        }
                      }
                      return groups.flatMap((group) =>
                        group.map((entry, column) => {
                          const width = 95 / group.length;
                          const height = Math.max(
                            45,
                            ((entry.end - entry.start) / 60) * slotHeight,
                          );
                          return (
                            <div
                              key={entry.event.id}
                              className="absolute z-10"
                              data-calendar-event={entry.event.id}
                              style={{
                                top:
                                  ((entry.start - startHour * 60) / 60) *
                                  slotHeight,
                                height,
                                left: `${2.5 + column * width}%`,
                                width: `${width}%`,
                              }}
                            >
                              {renderEvent(entry.event.value, {
                                height,
                                width: (width / 100) * 180,
                              })}
                            </div>
                          );
                        }),
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
