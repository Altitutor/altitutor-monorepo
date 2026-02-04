"use client";

import { useMemo, useState, useEffect } from 'react';
import { Button } from '@altitutor/ui';
import { addDays, startOfWeek, format, differenceInMinutes, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSessions } from '../hooks/useSessionsQuery';
import { sessionsApi } from '../api/sessions';
import { cn } from '@/shared/utils/index';
import { SessionCard } from './SessionCard';
import type { SessionStaff, SessionStudent } from '../utils/session-helpers';
import type { Database } from '@altitutor/shared';

type TutorSessionRow = Database['public']['Views']['vtutor_sessions']['Row'];

interface TutorSession {
  session_id: string;
  session_type: string;
  class_id: string | null;
  subject_id: string | null;
  start_at: string | null;
  end_at: string | null;
  class_day_of_week: number | null;
  class_start_time: string | null;
  class_end_time: string | null;
  class_room: string | null;
  class_level: string | null;
  class_status: string | null;
  subject_name: string | null;
  subject_curriculum: string | null;
  subject_discipline: string | null;
  subject_level: string | null;
  subject_color: string | null;
  subject_year_level: number | null;
}

interface StudentMember {
  id: string;
  first_name: string;
  last_name: string;
  year_level?: number;
}

type Props = { onOpenSession?: (id: string) => void };

export function SessionsCalendarView({ onOpenSession }: Props) {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const { data: sessions = [] } = useSessions();
  const [sessionDetailsMap, setSessionDetailsMap] = useState<Record<string, { staff: SessionStaff[]; students: SessionStudent[] }>>({});

  // Fetch session details (staff and students) for all sessions
  useEffect(() => {
    const fetchSessionDetails = async () => {
      if (sessions.length === 0) return;
      
      const sessionIds = sessions
        .map((s) => {
          if ('session_id' in s && typeof s.session_id === 'string') {
            return s.session_id;
          }
          return null;
        })
        .filter((id): id is string => id != null);
      
      if (sessionIds.length === 0) return;
      
      try {
        const detailsMap = await sessionsApi.getSessionsWithDetails(sessionIds);
        setSessionDetailsMap(detailsMap);
      } catch (error) {
        console.error('Failed to fetch session details:', error);
      }
    };

    fetchSessionDetails();
  }, [sessions]);

  // Time grid similar to classes timetable
  const slots = Array.from({ length: 12 }, (_, i) => 9 + i); // 9..20 hours
  const slotHeight = 60; // px per hour

  const getDaySessions = (d: Date): TutorSessionRow[] => {
    return sessions.filter((s): s is TutorSessionRow => {
      if ('start_at' in s && typeof s.start_at === 'string' && s.start_at) {
        try {
          return isSameDay(new Date(s.start_at), d);
        } catch {
          return false;
        }
      }
      return false;
    });
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
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[60px] flex items-center justify-center">
                {format(new Date(2000, 0, 1, hour, 0), 'h a')}
              </div>
              {days.map((d, _dayIdx) => {
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
                        const daySessions = getDaySessions(d).sort((a, b) => {
                          const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
                          const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
                          return aTime - bTime;
                        });
                        // Build overlap groups
                        const groups: TutorSessionRow[][] = [];
                        const processed = new Set<string>();
                        const toMinutes = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();
                        daySessions.forEach((s) => {
                          // Use session_id from vtutor_sessions view
                          const sessionId = s.session_id;
                          if (!sessionId || processed.has(sessionId)) return;
                          if (!s.start_at || !s.end_at) return;
                          const sStart = toMinutes(new Date(s.start_at));
                          const sEnd = toMinutes(new Date(s.end_at));
                          const group = [s];
                          processed.add(sessionId);
                          daySessions.forEach((o) => {
                            const otherSessionId = o.session_id;
                            if (!otherSessionId || processed.has(otherSessionId)) return;
                            if (!o.start_at || !o.end_at) return;
                            const oStart = toMinutes(new Date(o.start_at));
                            const oEnd = toMinutes(new Date(o.end_at));
                            if (sStart < oEnd && sEnd > oStart) {
                              group.push(o);
                              processed.add(otherSessionId);
                            }
                          });
                          groups.push(group);
                        });
                        const blocks: JSX.Element[] = [];
                        groups.forEach((group) => {
                          const total = group.length;
                          const columnWidth = total > 1 ? 95 / total : 95;
                          group.forEach((s, idx: number) => {
                            if (!s.start_at || !s.end_at) return;
                            const sStart = new Date(s.start_at);
                            const sEnd = new Date(s.end_at);
                            const top = Math.max(0, (minutesFromStart(sStart) / 60) * slotHeight);
                            const height = Math.max(30, (differenceInMinutes(sEnd, sStart) / 60) * slotHeight);
                            const left = (idx * columnWidth) + 2.5;
                            
                            // Calculate actual pixel dimensions for smart sizing
                            const cardHeight = Math.max(height, 45);
                            const estimatedColumnWidth = 180;
                            const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                            
                            // Use session_id from vtutor_sessions view
                            const sessionId = s.session_id;
                            if (!sessionId) return;
                            const details = sessionDetailsMap[sessionId] || { staff: [], students: [] };
                            
                            // Check if session has any students attending (planned attendance)
                            // Note: tutor-web views don't include planned_absence, so we check if students array is empty
                            const hasAttendingStudents = (details.students || []).length > 0;
                            
                            // Transform session to match TutorSession type expected by SessionCard
                            const sessionForCard: TutorSession = {
                              session_id: sessionId,
                              session_type: s.session_type || '',
                              class_id: s.class_id,
                              subject_id: s.subject_id,
                              start_at: s.start_at,
                              end_at: s.end_at,
                              class_day_of_week: s.class_day_of_week,
                              class_start_time: s.class_start_time,
                              class_end_time: s.class_end_time,
                              class_room: s.class_room,
                              class_level: s.class_level,
                              class_status: s.class_status,
                              subject_name: s.subject_name,
                              subject_curriculum: s.subject_curriculum,
                              subject_discipline: s.subject_discipline,
                              subject_level: s.subject_level,
                              subject_color: s.subject_color,
                              subject_year_level: s.subject_year_level,
                            };
                            
                            // Transform students to match StudentMember type (year_level: number | undefined)
                            const transformedStudents: StudentMember[] = (details.students || []).map(student => ({
                              id: student.id,
                              first_name: student.first_name,
                              last_name: student.last_name,
                              year_level: student.year_level !== null ? student.year_level : undefined,
                            }));
                            
                            blocks.push(
                              <div
                                key={sessionId}
                                className={cn("absolute", !hasAttendingStudents && "opacity-50")}
                                style={{ top: `${top}px`, height: `${cardHeight}px`, left: `${left}%`, width: `${columnWidth}%`, zIndex: 10, minHeight: '45px' }}
                              >
                                <SessionCard
                                  session={sessionForCard}
                                  staff={details.staff}
                                  students={transformedStudents}
                                  onClick={() => onOpenSession && onOpenSession(sessionId)}
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
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


