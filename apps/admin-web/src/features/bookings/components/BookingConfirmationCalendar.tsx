'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { calculateSessionOverlapGroups, calculateSessionPosition } from '../utils/sessionOverlap';
import type { Tables } from '@altitutor/shared';

interface BookingConfirmationCalendarProps {
  /** The new session that will be booked (to highlight) */
  newSession: {
    start_at: string;
    end_at: string;
    type: string;
    subject_id?: string | null;
  };
  /** Existing sessions for the day */
  existingSessions?: Array<{
    id: string;
    start_at: string;
    end_at: string;
    type: string;
    subject_id?: string | null;
    class_id?: string | null;
  }>;
  /** Subject data for color coding */
  subjectsById?: Record<string, Tables<'subjects'>>;
  /** Classes data */
  classesById?: Record<string, Tables<'classes'>>;
  /** Session staff data */
  sessionStaff?: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>>;
  /** Session students data */
  sessionStudents?: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean; sessions_students_id?: string | null }>>;
}

export function BookingConfirmationCalendar({
  newSession,
  existingSessions = [],
  subjectsById = {},
  classesById = {},
  sessionStaff = {},
  sessionStudents = {},
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
      ...existingSessions,
      {
        id: 'new-session-preview',
        start_at: newSession.start_at,
        end_at: newSession.end_at,
        type: newSession.type as Tables<'sessions'>['type'],
        subject_id: newSession.subject_id,
        class_id: null,
        status: 'ACTIVE' as Tables<'sessions'>['status'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }, [existingSessions, newSession]);

  // Calculate overlap groups
  const overlapGroups = useMemo(() => {
    return calculateSessionOverlapGroups(allSessions, sessionDate);
  }, [allSessions, sessionDate]);

  // Time grid: 9am to 8pm
  const slots = Array.from({ length: 12 }, (_, i) => 9 + i);
  const slotHeight = 75; // px per hour
  const startHour = 9;

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
                  {overlapGroups.map((group) => {
                    const total = group.length;
                    const columnWidth = total > 1 ? 95 / total : 95;
                    
                    return group.map((s, idx) => {
                      const { top, height } = calculateSessionPosition(s, startHour, slotHeight);
                      const left = idx * columnWidth + 2.5;

                      const isNewSession = s.id === 'new-session-preview';
                      const cls = s.class_id ? classesById[s.class_id] : undefined;
                      const subj = cls?.subject_id 
                        ? subjectsById[cls.subject_id] 
                        : s.subject_id 
                        ? subjectsById[s.subject_id] 
                        : undefined;
                      const sessionStaffList = sessionStaff[s.id] || [];
                      const sessionStudentsList = sessionStudents[s.id] || [];

                      // Calculate card dimensions
                      const cardHeight = Math.max(height, 45);
                      const estimatedColumnWidth = 400; // Approximate column width for single day view
                      const cardWidth = (columnWidth / 100) * estimatedColumnWidth;

                      return (
                        <div
                          key={s.id}
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
                          <SessionsCard
                            session={s as Tables<'sessions'>}
                            classData={cls}
                            subject={subj}
                            staff={sessionStaffList}
                            students={sessionStudentsList}
                            onClick={() => {}}
                            isCalendarView={true}
                            cardHeight={cardHeight}
                            cardWidth={cardWidth}
                          />
                        </div>
                      );
                    });
                  }).flat()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
