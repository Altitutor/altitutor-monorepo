'use client';

import { useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { addDays, startOfWeek, format, differenceInMinutes, isSameDay, parseISO } from 'date-fns';
import { Button } from './button';
import { cn } from '../lib/cn';
// Type import from shared package - using inline type definition to avoid tsconfig issues

export interface BookingCalendarViewProps {
  /** The new session that will be booked (to highlight) */
  newSession: {
    start_at: string;
    end_at: string;
    type: string;
    subject_id?: string | null;
  };
  /** Existing sessions for the week */
  existingSessions?: Array<{
    id: string;
    start_at: string;
    end_at: string;
    type: string;
    subject_id?: string | null;
    class_id?: string | null;
  }>;
  /** Subject data for color coding */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subjectsById?: Record<string, any>;
  /** Classes data */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classesById?: Record<string, any>;
  /** Callback when clicking on an existing session */
  onSessionClick?: (sessionId: string) => void;
  /** Week anchor date (defaults to new session date) */
  weekAnchor?: Date;
  /** Callback when week changes */
  onWeekChange?: (weekStart: Date) => void;
  /** Show only single day (hide navigation buttons) */
  singleDay?: boolean;
}

export function BookingCalendarView({
  newSession,
  existingSessions = [],
  subjectsById = {},
  classesById = {},
  onSessionClick,
  weekAnchor,
  onWeekChange,
  singleDay = false,
}: BookingCalendarViewProps) {
  const newSessionStart = parseISO(newSession.start_at);
  const [anchor, setAnchor] = useState(weekAnchor || newSessionStart);
  
  // Update anchor when weekAnchor prop changes
  useEffect(() => {
    if (weekAnchor) {
      setAnchor(weekAnchor);
    }
  }, [weekAnchor]);
  
  const weekStart = useMemo(() => {
    if (singleDay) {
      // For single day view, use the session date itself
      const date = new Date(newSessionStart);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return startOfWeek(anchor, { weekStartsOn: 1 });
  }, [anchor, singleDay, newSessionStart]);

  // Combine existing sessions with the new session for display
  const allSessions = useMemo(() => {
    return [
      ...existingSessions,
      {
        id: 'new-session-preview',
        start_at: newSession.start_at,
        end_at: newSession.end_at,
        type: newSession.type,
        subject_id: newSession.subject_id,
        class_id: null,
      },
    ];
  }, [existingSessions, newSession]);

  // Time grid: 9am to 8pm
  const slots = Array.from({ length: 12 }, (_, i) => 9 + i);
  const slotHeight = 75; // px per hour

  const getDaySessions = (d: Date) => {
    return allSessions.filter((s) => s.start_at && isSameDay(parseISO(s.start_at), d));
  };

  const getSessionColor = (session: typeof allSessions[0]): { className: string; style: CSSProperties } => {
    const isNewSession = session.id === 'new-session-preview';
    
    // Highlight new session with a distinct style
    if (isNewSession) {
      return {
        className: 'bg-primary text-primary-foreground border-2 border-primary shadow-lg ring-2 ring-primary/20',
        style: {},
      };
    }

    // Use subject color for existing sessions
    const cls = session.class_id ? classesById[session.class_id] : undefined;
    const subj = cls?.subject_id ? subjectsById[cls.subject_id] : session.subject_id ? subjectsById[session.subject_id] : undefined;
    
    if (subj?.color) {
      return {
        className: 'border-2 dark:bg-opacity-80',
        style: { 
          backgroundColor: subj.color, 
          borderColor: subj.color,
        },
      };
    }

    return {
      className: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600',
      style: {},
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSessionLabel = (session: any): string => {
    const isNewSession = session.id === 'new-session-preview';
    if (isNewSession) {
      return 'New Session';
    }

    const cls = session.class_id ? classesById[session.class_id] : undefined;
    const subj = cls?.subject_id ? subjectsById[cls.subject_id] : session.subject_id ? subjectsById[session.subject_id] : undefined;
    
    if (!subj) {
      return session.type;
    }

    const parts: string[] = [];
    if (subj.curriculum) parts.push(String(subj.curriculum));
    if (subj.year_level != null) parts.push(String(subj.year_level));
    if (subj.name) parts.push(subj.name);
    return parts.join(' ');
  };

  const days = useMemo(() => {
    if (singleDay) {
      // Show only the day of the session
      return [newSessionStart];
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [singleDay, weekStart, newSessionStart]);

  const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (9 * 60);

  const now = new Date();
  const todayDayIndex = days.findIndex((d) => isSameDay(d, now));
  const currentMinutesFromStart = minutesFromStart(now);
  const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < (slots.length * 60);

  return (
    <div className="flex flex-col gap-3">
      {!singleDay && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newAnchor = addDays(anchor, -7);
              setAnchor(newAnchor);
              onWeekChange?.(newAnchor);
            }}
          >
            Previous Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              setAnchor(today);
              onWeekChange?.(today);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newAnchor = addDays(anchor, 7);
              setAnchor(newAnchor);
              onWeekChange?.(newAnchor);
            }}
          >
            Next Week
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto relative border rounded-lg">
        <div
          className="grid gap-0 min-h-full relative bg-background"
          style={{ gridTemplateColumns: `minmax(80px, 100px) repeat(${days.length}, minmax(150px, 1fr))` }}
        >
          {/* Headers */}
          <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">
            Time
          </div>
          {days.map((d) => {
            const isToday = isSameDay(d, now);
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm',
                  isToday && 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                )}
              >
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
                  <div
                    key={`${d.toISOString()}-${hour}`}
                    className={cn(
                      'relative border-b border-r h-[75px]',
                      isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-background'
                    )}
                  >
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
                          const daySessions = getDaySessions(d).sort(
                            (a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime()
                          );

                          // Build overlap groups
                          type SessionItem = typeof allSessions[0];
                          const groups: SessionItem[][] = [];
                          const processed = new Set<string>();
                          const toMinutes = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();

                          daySessions.forEach((s) => {
                            if (processed.has(s.id)) return;
                            const sStart = toMinutes(parseISO(s.start_at));
                            const sEnd = toMinutes(parseISO(s.end_at));
                            const group: SessionItem[] = [s];
                            processed.add(s.id);

                            daySessions.forEach((o) => {
                              if (processed.has(o.id)) return;
                              const oStart = toMinutes(parseISO(o.start_at));
                              const oEnd = toMinutes(parseISO(o.end_at));
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
                            group.forEach((s, idx) => {
                              const sStart = parseISO(s.start_at);
                              const sEnd = parseISO(s.end_at);
                              const top = Math.max(0, (minutesFromStart(sStart) / 60) * slotHeight);
                              const height = Math.max(30, (differenceInMinutes(sEnd, sStart) / 60) * slotHeight);
                              const left = idx * columnWidth + 2.5;

                              const isNewSession = s.id === 'new-session-preview';
                              const { className, style: sessionStyle } = getSessionColor(s);
                              const label = getSessionLabel(s);

                              blocks.push(
                                <div
                                  key={s.id}
                                  className={cn('absolute', className)}
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: `${left}%`,
                                    width: `${columnWidth}%`,
                                    zIndex: isNewSession ? 20 : 10,
                                    minHeight: '45px',
                                    cursor: onSessionClick && !isNewSession ? 'pointer' : 'default',
                                    ...sessionStyle,
                                  }}
                                  onClick={() => {
                                    if (onSessionClick && !isNewSession) {
                                      onSessionClick(s.id);
                                    }
                                  }}
                                >
                                  <div className="p-1.5 h-full flex flex-col justify-between text-xs">
                                    <div className="font-medium truncate">{label}</div>
                                    <div className="text-[10px] opacity-80 truncate">
                                      {format(sStart, 'h:mm a')} - {format(sEnd, 'h:mm a')}
                                    </div>
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
