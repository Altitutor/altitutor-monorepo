'use client';

import { format, isSameDay, parseISO } from 'date-fns';
import { useTutorSessionDetailsBatch } from '../hooks/useSessionsQuery';
import { cn } from '@/shared/utils';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';
import { useElementSize } from '@/shared/hooks/useElementSize';
import { SessionCard } from './SessionCard';
import type { Database } from '@altitutor/shared';
import type { SessionStudent } from '../utils/session-helpers';

type TutorSessionRow = Database['public']['Views']['vtutor_sessions']['Row'];

type Props = {
  date: string;
  sessions: TutorSessionRow[];
  isLoading?: boolean;
  onOpenSession?: (id: string) => void;
};

export function TutorTodaySessionsCalendarView({ date, sessions, isLoading, onOpenSession }: Props) {
  const [dayColumnRef, dayColumnSize] = useElementSize<HTMLDivElement>();
  const selectedDate = parseISO(date);
  const today = new Date();
  const isViewingToday = isSameDay(selectedDate, today);

  const todaySessions = sessions.filter(
    (session): session is TutorSessionRow & { session_id: string; start_at: string } =>
      Boolean(session.session_id && session.start_at && isSameDay(new Date(session.start_at), selectedDate))
  );

  const detailIds = todaySessions.map((session) => session.session_id);
  const { data: detailsMap } = useTutorSessionDetailsBatch(detailIds);

  const slotHeight = 75;

  const calculateTimeRange = () => {
    if (todaySessions.length === 0) {
      return { startHour: 9, slots: Array.from({ length: 12 }, (_, index) => 9 + index) };
    }

    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    todaySessions.forEach((session) => {
      if (session.start_at) {
        earliestStart = Math.min(earliestStart, adelaideTimeToMinutes(session.start_at));
      }
      if (session.end_at) {
        latestEnd = Math.max(latestEnd, adelaideTimeToMinutes(session.end_at));
      }
    });

    const startHour = Math.max(0, Math.floor(earliestStart / 60));
    const endAtHourBoundary = latestEnd % 60 === 0 ? latestEnd / 60 : Math.ceil(latestEnd / 60);
    const endHour = Math.min(23, Math.max(startHour, endAtHourBoundary - 1));
    const slotCount = endHour - startHour + 1;
    const slots = Array.from({ length: slotCount }, (_, index) => startHour + index);

    return { startHour, slots };
  };

  const { startHour, slots } = calculateTimeRange();
  const minutesFromStart = (isoString: string) => adelaideTimeToMinutes(isoString) - startHour * 60;
  const currentMinutesFromStart = today.getHours() * 60 + today.getMinutes() - startHour * 60;
  const totalMinutesInRange = slots.length * 60;
  const showTodayIndicator =
    isViewingToday && currentMinutesFromStart >= 0 && currentMinutesFromStart < totalMinutesInRange;
  const dayColumnWidth = dayColumnSize.width;

  if (isLoading) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading today’s sessions…</p>;
  }

  if (todaySessions.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No sessions scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-auto">
      <div
        className="relative grid gap-0 bg-background"
        style={{ gridTemplateColumns: 'minmax(80px, 100px) 1fr' }}
      >
        <div className="sticky top-0 z-20 border-b border-r bg-background p-2 text-center text-xs font-medium">
          Time
        </div>
        <div className="sticky top-0 z-20 border-b border-r bg-blue-50 p-2 text-center text-sm font-medium text-blue-700 dark:bg-transparent dark:text-foreground">
          {format(selectedDate, 'EEE dd MMM')}
        </div>

        {slots.map((hour, index) => (
          <div key={hour} className="contents">
            <div className="sticky left-0 z-10 flex h-[75px] items-center justify-center border-b border-r bg-muted/30 p-2 text-center text-sm font-medium">
              {format(new Date(2000, 0, 1, hour, 0), 'h a')}
            </div>
            <div
              ref={index === 0 ? dayColumnRef : undefined}
              className="relative h-[75px] border-b border-r bg-blue-50/30 dark:bg-transparent"
            >
              {index === 0 && (
                <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                  {showTodayIndicator && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-30"
                      style={{ top: `${(currentMinutesFromStart / 60) * slotHeight}px` }}
                    >
                      <div className="flex items-center">
                        <div className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                        <div className="h-0.5 flex-1 bg-red-500" />
                      </div>
                    </div>
                  )}
                  {(() => {
                    const daySessions = [...todaySessions].sort(
                      (a, b) => new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime()
                    );
                    const groups: typeof daySessions[] = [];
                    const processed = new Set<string>();

                    daySessions.forEach((session) => {
                      if (processed.has(session.session_id)) return;
                      const group = [session];
                      processed.add(session.session_id);

                      let foundNewOverlap = true;
                      while (foundNewOverlap) {
                        foundNewOverlap = false;
                        daySessions.forEach((other) => {
                          if (processed.has(other.session_id) || !other.start_at || !other.end_at) return;
                          const otherStart = adelaideTimeToMinutes(other.start_at);
                          const otherEnd = adelaideTimeToMinutes(other.end_at);
                          const overlapsWithGroup = group.some((groupSession) => {
                            if (!groupSession.start_at || !groupSession.end_at) return false;
                            const groupStart = adelaideTimeToMinutes(groupSession.start_at);
                            const groupEnd = adelaideTimeToMinutes(groupSession.end_at);
                            return groupStart < otherEnd && groupEnd > otherStart;
                          });
                          if (overlapsWithGroup) {
                            group.push(other);
                            processed.add(other.session_id);
                            foundNewOverlap = true;
                          }
                        });
                      }
                      groups.push(group);
                    });

                    const blocks: JSX.Element[] = [];
                    groups.forEach((group) => {
                      const total = group.length;
                      const columnWidth = total > 1 ? 95 / total : 95;
                      group.forEach((session, sessionIndex) => {
                        if (!session.start_at || !session.end_at) return;
                        const startMinutes = adelaideTimeToMinutes(session.start_at);
                        const endMinutes = adelaideTimeToMinutes(session.end_at);
                        const top = Math.max(0, (minutesFromStart(session.start_at) / 60) * slotHeight);
                        const height = Math.max(30, ((endMinutes - startMinutes) / 60) * slotHeight);
                        const left = sessionIndex * columnWidth + 2.5;
                        const cardHeight = Math.max(height, 45);
                        const cardWidth =
                          dayColumnWidth > 0 ? (dayColumnWidth * columnWidth) / 100 : columnWidth;
                        const details = detailsMap?.[session.session_id];
                        const students: SessionStudent[] = details?.students ?? [];
                        const hasAttendingStudents =
                          students.length === 0 || students.some((student) => !student.planned_absence);

                        blocks.push(
                          <div
                            key={session.session_id}
                            className={cn('absolute', !hasAttendingStudents && 'opacity-50')}
                            style={{
                              top: `${top}px`,
                              height: `${cardHeight}px`,
                              left: `${left}%`,
                              width: `${columnWidth}%`,
                              zIndex: 10,
                              minHeight: '45px',
                            }}
                          >
                            <SessionCard
                              session={{
                                session_id: session.session_id,
                                session_type: session.session_type ?? '',
                                class_id: session.class_id,
                                subject_id: session.subject_id,
                                start_at: session.start_at,
                                end_at: session.end_at,
                                class_day_of_week: session.class_day_of_week,
                                class_start_time: session.class_start_time,
                                class_end_time: session.class_end_time,
                                class_room: session.class_room,
                                class_level: session.class_level,
                                class_status: session.class_status,
                                subject_name: session.subject_name,
                                subject_curriculum: session.subject_curriculum,
                                subject_discipline: session.subject_discipline,
                                subject_level: session.subject_level,
                                subject_color: session.subject_color,
                                subject_year_level: session.subject_year_level,
                              }}
                              staff={details?.staff}
                              students={students.map((student) => ({
                                id: student.id,
                                first_name: student.first_name,
                                last_name: student.last_name,
                                year_level: student.year_level ?? undefined,
                                planned_absence: student.planned_absence,
                                is_extra: student.is_extra,
                                account_class: student.account_class,
                              }))}
                              onClick={() => onOpenSession?.(session.session_id)}
                              isCalendarView
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
