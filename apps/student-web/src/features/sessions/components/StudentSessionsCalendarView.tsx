"use client";

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { addDays, startOfWeek, endOfWeek, format, differenceInMinutes, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStudentSessions } from '../hooks/useSessions';
import { cn } from '@/shared/utils/index';
import { getSubjectColorHex } from '@/shared/utils';
import { StudentSessionsCard } from './StudentSessionsCard';
import { SessionHoverTooltip } from './SessionHoverTooltip';
import { Button } from "@altitutor/ui";

export function StudentSessionsCalendarView() {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => endOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  
  const { data: sessions } = useStudentSessions(
    format(weekStart, 'yyyy-MM-dd'),
    format(weekEnd, 'yyyy-MM-dd')
  );

  // Calculate dynamic time range: 1 hour before first session, 1 hour after last session
  const timeRange = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return { startHour: 9, endHour: 20 }; // Default range
    }
    
    const allStartTimes = sessions
      .map(s => s.start_at ? new Date(s.start_at) : null)
      .filter((d): d is Date => d !== null);
    
    const allEndTimes = sessions
      .map(s => s.end_at ? new Date(s.end_at) : null)
      .filter((d): d is Date => d !== null);
    
    if (allStartTimes.length === 0 || allEndTimes.length === 0) {
      return { startHour: 9, endHour: 20 };
    }
    
    const earliestStart = Math.min(...allStartTimes.map(d => d.getHours() * 60 + d.getMinutes()));
    const latestEnd = Math.max(...allEndTimes.map(d => d.getHours() * 60 + d.getMinutes()));
    
    const startHour = Math.max(0, Math.floor((earliestStart - 60) / 60));
    const endHour = Math.min(23, Math.ceil((latestEnd + 60) / 60));
    
    return { startHour, endHour };
  }, [sessions]);

  const slotHeight = 75; // px per hour
  const slots = Array.from({ length: timeRange.endHour - timeRange.startHour }, (_, i) => timeRange.startHour + i);

  const getDaySessions = (d: Date) => {
    return (sessions || []).filter((s) => s.start_at && isSameDay(new Date(s.start_at), d));
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Helpers to compute block positions
  const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (timeRange.startHour * 60);

  // Current time indicator - only show if within the visible time window
  const now = new Date();
  const todayDayIndex = days.findIndex(d => isSameDay(d, now));
  const currentMinutesFromStart = minutesFromStart(now);
  const totalMinutesInRange = slots.length * 60; // Total minutes in the visible time range
  const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < totalMinutesInRange;

  return (
    <div className="flex flex-col">
      <div className="flex gap-2 justify-end mb-3">
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative overflow-x-auto">
        <div
          className="grid gap-0 relative bg-background"
          style={{ gridTemplateColumns: `minmax(80px, 100px) repeat(7, minmax(150px, 1fr))`, minWidth: 'max-content' }}
        >
          {/* Headers */}
          <div className="sticky z-20 p-2 text-center font-medium bg-background border-b border-r text-xs" style={{ top: '-1.5rem' }}>Time</div>
          {days.map((d) => {
            const isToday = isSameDay(d, now);
            return (
              <div key={d.toISOString()} className={cn(
                "sticky z-20 p-2 text-center font-medium bg-background border-b border-r text-sm",
                isToday && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
              )} style={{ top: '-1.5rem' }}>
                {format(d, 'EEE dd MMM')}
              </div>
            );
          })}

          {/* Rows */}
          {slots.map((hour, idx) => (
            <div key={hour} className="contents">
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
                {format(new Date(2000, 0, 1, hour, 0), 'h a')}
              </div>
              {days.map((d, _dayIdx) => {
                const isToday = isSameDay(d, now);
                return (
                  <div key={`${d.toISOString()}-${hour}`} className={cn(
                    "relative border-b border-r h-[75px]",
                    isToday ? "bg-blue-50/30 dark:bg-blue-900/10" : "bg-background"
                  )}>
                    {idx === 0 && (
                      <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                        {/* Today indicator line */}
                        {isToday && showTodayIndicator && (
                          <div 
                            className="absolute left-0 right-0 z-30 pointer-events-none"
                            style={{ top: `${(currentMinutesFromStart / 60) * slotHeight}px` }}
                          >
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                              <div className="flex-1 h-0.5 bg-red-500" />
                            </div>
                          </div>
                        )}
                        {(() => {
                        const daySessions = getDaySessions(d).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
                        // Build overlap groups
                        const groups: typeof daySessions[][] = [];
                        const processed = new Set<string>();
                        const toMinutes = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();
                        daySessions.forEach((s) => {
                          if (processed.has(s.session_id)) return;
                          const sStart = toMinutes(new Date(s.start_at));
                          const sEnd = toMinutes(new Date(s.end_at));
                          const group = [s];
                          processed.add(s.session_id);
                          daySessions.forEach((o) => {
                            if (processed.has(o.session_id)) return;
                            const oStart = toMinutes(new Date(o.start_at));
                            const oEnd = toMinutes(new Date(o.end_at));
                            if (sStart < oEnd && sEnd > oStart) {
                              group.push(o);
                              processed.add(o.session_id);
                            }
                          });
                          groups.push(group);
                        });
                        const blocks: JSX.Element[] = [];
                        groups.forEach((group) => {
                          const total = group.length;
                          const columnWidth = total > 1 ? 95 / total : 95;
                          group.forEach((s, idx: number) => {
                            const sStart = new Date(s.start_at);
                            const sEnd = new Date(s.end_at);
                            const top = Math.max(0, (minutesFromStart(sStart) / 60) * slotHeight);
                            const height = Math.max(30, (differenceInMinutes(sEnd, sStart) / 60) * slotHeight);
                            const left = (idx * columnWidth) + 2.5;
                            
                            // Calculate actual pixel dimensions for smart sizing
                            const cardHeight = Math.max(height, 45);
                            const estimatedColumnWidth = 180;
                            const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                            
                            // Check if this is an extra session (class_id IS NULL)
                            const isExtra = s.class_id === null;
                            // Check if student is not attending (planned_absence is true)
                            const isNotAttending = s.planned_absence === true;
                            
                            blocks.push(
                              <div
                                key={s.session_id}
                                className="absolute"
                                style={{ top: `${top}px`, height: `${cardHeight}px`, left: `${left}%`, width: `${columnWidth}%`, zIndex: 10, minHeight: '45px' }}
                              >
                                <SessionHoverTooltip session={s}>
                                  <div className="h-full w-full">
                                    <StudentSessionsCard
                                      session={s}
                                      staff={s.staff || []}
                                      students={s.students || []}
                                      isCalendarView={true}
                                      cardHeight={cardHeight}
                                      cardWidth={cardWidth}
                                      isExtra={isExtra}
                                      isNotAttending={isNotAttending}
                                    />
                                  </div>
                                </SessionHoverTooltip>
                              </div>
                            );
                          });
                        });
                          return blocks;
                        })()}
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
