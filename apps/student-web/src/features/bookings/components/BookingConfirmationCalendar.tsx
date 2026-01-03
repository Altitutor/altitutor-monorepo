'use client';

import { useMemo } from 'react';
import { format, differenceInMinutes, isSameDay, parseISO } from 'date-fns';
import { StudentSessionsCard } from '@/features/sessions/components/StudentSessionsCard';
import type { StudentSessionWithStaff } from '@/features/sessions/api/sessions';

interface BookingConfirmationCalendarProps {
  /** The new session that was booked (to highlight) */
  newSession: {
    start_at: string;
    end_at: string;
    type: string;
    subject_id?: string | null;
    subject?: {
      curriculum?: string | null;
      year_level?: number | null;
      name?: string | null;
      level?: string | null;
    } | null;
    staff?: Array<{
      id: string;
      first_name: string;
      last_name: string;
    }>;
  };
  /** Existing sessions for the day */
  existingSessions?: StudentSessionWithStaff[];
}

export function BookingConfirmationCalendar({
  newSession,
  existingSessions = [],
}: BookingConfirmationCalendarProps) {
  const newSessionStart = parseISO(newSession.start_at);
  const sessionDate = useMemo(() => {
    const date = new Date(newSessionStart);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [newSessionStart]);

  // Combine existing sessions with the new session for display
  const allSessions = useMemo(() => {
    return [
      ...existingSessions.map(s => ({
        ...s,
        id: s.session_id, // Add id field for compatibility
      })),
      {
        session_id: 'new-session-preview',
        id: 'new-session-preview', // For compatibility
        start_at: newSession.start_at,
        end_at: newSession.end_at,
        session_type: newSession.type as 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'CLASS',
        subject_id: newSession.subject_id,
        class_id: null,
        staff: newSession.staff || [],
        students: [],
        // Add subject details for display (matching vstudent_session_base structure)
        subject_name: newSession.subject?.name || null,
        subject_curriculum: newSession.subject?.curriculum || null,
        subject_level: newSession.subject?.level || null,
        subject_year_level: newSession.subject?.year_level || null,
        subject_discipline: null,
        subject_color: null,
        session_student_id: null,
        planned_absence: false,
        planned_absence_logged_at: null,
        is_rescheduled: false,
        rescheduled_at: null,
        is_credited: false,
        credited_at: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        room: null,
        class_level: null,
        class_status: null,
        session_created_at: new Date().toISOString(),
        session_updated_at: new Date().toISOString(),
      } as StudentSessionWithStaff & { id: string },
    ];
  }, [existingSessions, newSession]);

  const getDaySessions = (d: Date) => {
    return allSessions.filter((s) => s.start_at && isSameDay(parseISO(s.start_at), d));
  };

  const daySessions = getDaySessions(sessionDate).sort(
    (a, b) => parseISO(a.start_at!).getTime() - parseISO(b.start_at!).getTime()
  );

  // Calculate time range: 1 hour before first event to 1 hour after last event
  const timeRange = useMemo(() => {
    if (daySessions.length === 0) {
      return { startHour: 9, endHour: 17 }; // Default range
    }
    
    const allStartTimes = daySessions
      .map(s => s.start_at ? parseISO(s.start_at) : null)
      .filter((d): d is Date => d !== null);
    
    const allEndTimes = daySessions
      .map(s => s.end_at ? parseISO(s.end_at) : null)
      .filter((d): d is Date => d !== null);
    
    if (allStartTimes.length === 0 || allEndTimes.length === 0) {
      return { startHour: 9, endHour: 17 };
    }
    
    const earliestStart = Math.min(...allStartTimes.map(d => d.getHours() * 60 + d.getMinutes()));
    const latestEnd = Math.max(...allEndTimes.map(d => d.getHours() * 60 + d.getMinutes()));
    
    const startHour = Math.max(0, Math.floor((earliestStart - 60) / 60));
    const endHour = Math.min(23, Math.ceil((latestEnd + 60) / 60));
    
    return { startHour, endHour };
  }, [daySessions]);

  const slotHeight = 75; // px per hour
  const slots = Array.from({ length: timeRange.endHour - timeRange.startHour }, (_, i) => timeRange.startHour + i);

  const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (timeRange.startHour * 60);

  // Build overlap groups
  type SessionItem = StudentSessionWithStaff & { id: string };
  const groups: SessionItem[][] = [];
  const processed = new Set<string>();
  const toMinutes = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();

  daySessions.forEach((s) => {
    const sessionId = (s as any).id || s.session_id || '';
    if (processed.has(sessionId)) return;
    const sStart = toMinutes(parseISO(s.start_at!));
    const sEnd = toMinutes(parseISO(s.end_at!));
    const group: SessionItem[] = [s as SessionItem];
    processed.add(sessionId);

    daySessions.forEach((o) => {
      const oSessionId = (o as any).id || o.session_id || '';
      if (processed.has(oSessionId)) return;
      const oStart = toMinutes(parseISO(o.start_at!));
      const oEnd = toMinutes(parseISO(o.end_at!));
      if (sStart < oEnd && sEnd > oStart) {
        group.push(o as SessionItem);
        processed.add(oSessionId);
      }
    });

    groups.push(group);
  });

  return (
    <div className="flex-1 overflow-auto relative border rounded-lg">
      <div
        className="grid gap-0 min-h-full relative bg-background"
        style={{ gridTemplateColumns: `minmax(80px, 100px) minmax(150px, 1fr)` }}
      >
        {/* Headers */}
        <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">
          Time
        </div>
        <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm">
          {format(sessionDate, 'EEE dd MMM')}
        </div>

        {/* Rows */}
        {slots.map((hour, idx) => (
          <div key={hour} className="contents">
            <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
              {format(new Date(2000, 0, 1, hour, 0), 'h a')}
            </div>
            <div className="relative border-b border-r h-[75px] bg-background">
              {idx === 0 && (
                <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                  {(() => {
                    const blocks: JSX.Element[] = [];
                    groups.forEach((group) => {
                      const total = group.length;
                      const columnWidth = total > 1 ? 95 / total : 95;
                      group.forEach((s, idx) => {
                        const sStart = parseISO(s.start_at!);
                        const sEnd = parseISO(s.end_at!);
                        const top = Math.max(0, (minutesFromStart(sStart) / 60) * slotHeight);
                        const height = Math.max(45, (differenceInMinutes(sEnd, sStart) / 60) * slotHeight);
                        const left = idx * columnWidth + 2.5;

                        const sessionId = (s as any).id || s.session_id || '';
                        const isNewSession = sessionId === 'new-session-preview';
                        const cardHeight = Math.max(height, 45);
                        const estimatedColumnWidth = 400;
                        const cardWidth = (columnWidth / 100) * estimatedColumnWidth;

                        blocks.push(
                          <div
                            key={sessionId}
                            className="absolute"
                            style={{
                              top: `${top}px`,
                              height: `${cardHeight}px`,
                              left: `${left}%`,
                              width: `${columnWidth}%`,
                              zIndex: isNewSession ? 20 : 10,
                              minHeight: '45px',
                            }}
                          >
                            <StudentSessionsCard
                              session={s}
                              staff={s.staff || []}
                              students={s.students || []}
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
