"use client";

import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { usePrecreateSessions } from '../hooks/usePrecreateSessions';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { getSubjectColorHex, getSubjectColorStyle } from '@/shared/utils';
import { SessionsCard } from './SessionsCard';

type Props = { onOpenSession?: (id: string) => void };

export function TodaySessionsCalendarView({ onOpenSession }: Props) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  const { mutate: precreate } = usePrecreateSessions();
  const { data } = useSessionsWithDetails({ rangeStart: todayStr, rangeEnd: todayStr });

  // Precreate sessions for today
  useEffect(() => {
    precreate({ start_date: todayStr, end_date: todayStr });
  }, [todayStr, precreate]);

  const slotHeight = 75; // px per hour

  const getTodaySessions = (): Tables<'sessions'>[] => {
    const sessions = ((data?.sessions as Tables<'sessions'>[]) || [])
      .filter((s: any) => s.start_at && isSameDay(new Date(s.start_at), today));
    return sessions as Tables<'sessions'>[];
  };

  const todaySessions = getTodaySessions();

  // Calculate dynamic time range based on sessions
  const calculateTimeRange = () => {
    if (todaySessions.length === 0) {
      // Default range if no sessions
      return { startHour: 9, endHour: 20, slots: Array.from({ length: 12 }, (_, i) => 9 + i) };
    }

    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    todaySessions.forEach((s: any) => {
      if (s.start_at) {
        const startDate = new Date(s.start_at);
        const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        earliestStart = Math.min(earliestStart, startMinutes);
      }
      if (s.end_at) {
        const endDate = new Date(s.end_at);
        const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
        latestEnd = Math.max(latestEnd, endMinutes);
      }
    });

    // Add 1 hour buffer before earliest and after latest
    const startHour = Math.max(0, Math.floor(earliestStart / 60) - 1);
    // Calculate end hour: add 60 minutes to latest end time, then get the hour
    const endHourWithBuffer = latestEnd + 60; // Add 1 hour in minutes
    const endHour = Math.min(23, Math.floor(endHourWithBuffer / 60));

    // Generate slots for the range
    const slotCount = endHour - startHour + 1;
    const slots = Array.from({ length: slotCount }, (_, i) => startHour + i);

    return { startHour, endHour, slots };
  };

  const { startHour, slots } = calculateTimeRange();

  const _getDisplayLabel = (s: any): string => {
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

  const _getSessionColorClasses = (s: any): { className: string; style: CSSProperties } => {
    const cls: any = (data as any)?.classesById?.[s.class_id];
    const subj: any = cls?.subject_id ? (data as any)?.subjectsById?.[cls.subject_id] : undefined;
    if (!subj) {
      return { className: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600', style: {} };
    }
    const subjectColorHex = getSubjectColorHex(subj);
    const { textColorClass } = getSubjectColorStyle(subj);
    if (subjectColorHex) {
      return {
        className: `${textColorClass} border-2 dark:bg-opacity-80`,
        style: { backgroundColor: subjectColorHex, borderColor: subjectColorHex }
      };
    }
    return { className: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600', style: {} };
  };

  // Helpers to compute block positions
  const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (startHour * 60);

  // Current time indicator
  const currentMinutesFromStart = minutesFromStart(today);
  const totalMinutesInRange = slots.length * 60;
  const showTodayIndicator = currentMinutesFromStart >= 0 && currentMinutesFromStart < totalMinutesInRange;

  if (todaySessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sessions scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto relative">
      <div
        className="grid gap-0 relative bg-background"
        style={{ gridTemplateColumns: `minmax(80px, 100px) 1fr` }}
      >
        {/* Headers */}
        <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">
          Time
        </div>
        <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm bg-blue-50 dark:bg-transparent text-blue-700 dark:text-foreground">
          {format(today, 'EEE dd MMM')}
        </div>

        {/* Rows */}
        {slots.map((hour, idx) => (
          <div key={hour} className="contents">
            <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
              {format(new Date(2000, 0, 1, hour, 0), 'h a')}
            </div>
            <div className="relative border-b border-r h-[75px] bg-blue-50/30 dark:bg-transparent">
              {idx === 0 && (
                <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                  {/* Today indicator line */}
                  {showTodayIndicator && (
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
                    const daySessions = todaySessions.sort(
                      (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                    );
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
                        
                        const cls: any = (data as any)?.classesById?.[s.class_id];
                        const subj: any = cls?.subject_id ? (data as any)?.subjectsById?.[cls.subject_id] : undefined;
                        const sessionStudents = ((data as any)?.sessionStudents?.[s.id] || []) as Array<Tables<'students'> & { planned_absence?: boolean }>;
                        const sessionStaff = ((data as any)?.sessionStaff?.[s.id] || []) as Array<Tables<'staff'> & { planned_absence?: boolean }>;
                        
                        // Calculate actual pixel dimensions for smart sizing
                        const cardHeight = Math.max(height, 45);
                        // Estimate width: for today view, column is wider, estimate ~400-600px
                        const estimatedColumnWidth = 500; // Approximate column width for today view
                        const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                        
                        blocks.push(
                          <div
                            key={s.id}
                            className="absolute"
                            style={{
                              top: `${top}px`,
                              height: `${cardHeight}px`,
                              left: `${left}%`,
                              width: `${columnWidth}%`,
                              zIndex: 10,
                              minHeight: '45px',
                            }}
                            onClick={() => onOpenSession && onOpenSession(s.id)}
                          >
                            <SessionsCard
                              session={s}
                              classData={cls}
                              subject={subj}
                              staff={sessionStaff}
                              students={sessionStudents}
                              onClick={() => {}}
                              isCalendarView={true}
                              cardHeight={cardHeight}
                              cardWidth={cardWidth}
                            />
                          </div>
                        );
                      });
                    });
                    return blocks;
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

