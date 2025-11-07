"use client";

import { useMemo, useState, useEffect } from 'react';
import { Button, Card } from '@altitutor/ui';
import { addDays, startOfWeek, endOfWeek, format, differenceInMinutes, isSameDay } from 'date-fns';
import { usePrecreateSessions } from '../hooks/usePrecreateSessions';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { getSubjectDisciplineColor, getSubjectCurriculumColor } from '@/shared/utils/enum-colors';

type Props = { onOpenSession?: (id: string) => void };

export function SessionsCalendarView({ onOpenSession }: Props) {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => endOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const { mutate: precreate } = usePrecreateSessions();
  const { data } = useSessionsWithDetails({ rangeStart: format(weekStart, 'yyyy-MM-dd'), rangeEnd: format(weekEnd, 'yyyy-MM-dd') });

  // Precreate a bit ahead/behind for smoothness
  const preStart = format(addDays(weekStart, -7), 'yyyy-MM-dd');
  const preEnd = format(addDays(weekEnd, 21), 'yyyy-MM-dd');

  useEffect(() => {
    precreate({ start_date: preStart, end_date: preEnd });
  }, [preStart, preEnd]);

  // Time grid similar to classes timetable
  const slots = Array.from({ length: 12 }, (_, i) => 9 + i); // 9..20 hours
  const slotHeight = 60; // px per hour

  const getDaySessions = (d: Date): Tables<'sessions'>[] => {
    const sessions = ((data?.sessions as Tables<'sessions'>[]) || [])
      .filter((s: any) => s.start_at && isSameDay(new Date(s.start_at), d));
    return sessions as Tables<'sessions'>[];
  };

  const getDisplayLabel = (s: any): string => {
    const cls: any = (data as any)?.classesById?.[s.class_id];
    const subj: any = cls?.subject_id ? (data as any)?.subjectsById?.[cls.subject_id] : undefined;
    if (!cls || !subj) return s.type === 'CLASS' ? 'Class' : 'Meeting';
    const parts: string[] = [];
    if (subj.curriculum) parts.push(String(subj.curriculum));
    if (subj.year_level != null) parts.push(String(subj.year_level));
    if (subj.name) parts.push(subj.name);
    if (cls.level) parts.push(String(cls.level));
    return parts.join(' ');
  };

  const getSessionColorClasses = (s: any): string => {
    const cls: any = (data as any)?.classesById?.[s.class_id];
    const subj: any = cls?.subject_id ? (data as any)?.subjectsById?.[cls.subject_id] : undefined;
    if (!subj) {
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
    }
    if (subj.discipline) {
      const disciplineColor = getSubjectDisciplineColor(subj.discipline);
      return `${disciplineColor} border-2 dark:bg-opacity-80`;
    }
    if (subj.curriculum) {
      const curriculumColor = getSubjectCurriculumColor(subj.curriculum);
      return `${curriculumColor} border-2 dark:bg-opacity-80`;
    }
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Helpers to compute block positions
  const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (9 * 60);

  // Current time indicator
  const now = new Date();
  const todayDayIndex = days.findIndex(d => isSameDay(d, now));
  const currentMinutesFromStart = minutesFromStart(now);
  const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < (slots.length * 60);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}>Previous</Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}>Next</Button>
      </div>

      <div className="flex-1 overflow-auto relative">
        <div
          className="grid gap-0 min-h-full relative bg-background"
          style={{ gridTemplateColumns: `minmax(80px, 100px) repeat(7, minmax(150px, 1fr))` }}
        >
          {/* Headers */}
          <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">Time</div>
          {days.map((d) => {
            const isToday = isSameDay(d, now);
            return (
              <div key={d.toISOString()} className={cn(
                "sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm",
                isToday && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
              )}>
                {format(d, 'EEE dd MMM')}
              </div>
            );
          })}

          {/* Rows */}
          {slots.map((hour, idx) => (
            <div key={hour} className="contents">
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[60px] flex items-center justify-center">
                {format(new Date(2000, 0, 1, hour, 0), 'h a')}
              </div>
              {days.map((d, dayIdx) => {
                const isToday = isSameDay(d, now);
                return (
                  <div key={`${d.toISOString()}-${hour}`} className={cn(
                    "relative border-b border-r h-[60px]",
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
                        const daySessions = getDaySessions(d).sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
                        // Build overlap groups
                        const groups: any[][] = [];
                        const processed = new Set<string>();
                        const toMinutes = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();
                        daySessions.forEach((s: any) => {
                          if (processed.has(s.id)) return;
                          const sStart = toMinutes(new Date(s.start_at));
                          const sEnd = toMinutes(new Date(s.end_at));
                          const group = [s];
                          processed.add(s.id);
                          daySessions.forEach((o: any) => {
                            if (processed.has(o.id)) return;
                            const oStart = toMinutes(new Date(o.start_at));
                            const oEnd = toMinutes(new Date(o.end_at));
                            if (sStart < oEnd && sEnd > oStart) {
                              group.push(o);
                              processed.add(o.id);
                            }
                          });
                          groups.push(group);
                        });
                        const blocks: JSX.Element[] = [];
                        groups.forEach((group) => {
                          const total = group.length;
                          const columnWidth = total > 1 ? 95 / total : 95;
                          group.forEach((s: any, idx: number) => {
                            const sStart = new Date(s.start_at);
                            const sEnd = new Date(s.end_at);
                            const top = Math.max(0, (minutesFromStart(sStart) / 60) * slotHeight);
                            const height = Math.max(30, (differenceInMinutes(sEnd, sStart) / 60) * slotHeight);
                            const left = (idx * columnWidth) + 2.5;
                            blocks.push(
                              <div
                                key={s.id}
                                className={cn('absolute cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] rounded p-2 border text-xs font-medium overflow-hidden', getSessionColorClasses(s))}
                                style={{ top: `${top}px`, height: `${height}px`, left: `${left}%`, width: `${columnWidth}%`, zIndex: 10, minHeight: '45px' }}
                                onClick={() => onOpenSession && onOpenSession(s.id)}
                              >
                                <div className="font-semibold truncate text-xs leading-tight">
                                  {getDisplayLabel(s)}
                                </div>
                                <div className="text-xs opacity-90 truncate leading-tight mt-1">
                                  {format(new Date(s.start_at), 'HH:mm')} - {format(new Date(s.end_at), 'HH:mm')}
                                </div>
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


