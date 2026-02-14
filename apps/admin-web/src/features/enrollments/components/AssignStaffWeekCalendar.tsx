'use client';

import { useMemo, useState, useEffect } from 'react';
import { addDays, startOfWeek, endOfWeek, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';
import { cn } from '@/shared/utils';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext } from '../types/enrollment';

interface GeneratedSession {
  id: string;
  start_at: string;
  end_at: string;
  class_id: string | null;
  type: string;
  isPotential: boolean;
}

function generateClassSessions(
  classData: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'>,
  weekStart: Date,
  weekEnd: Date,
  assignmentDate: Date
): GeneratedSession[] {
  const sessions: GeneratedSession[] = [];
  const currentDate = new Date(weekStart);

  while (currentDate <= weekEnd) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = format(currentDate, 'yyyy-MM-dd');

    if (dayOfWeek === classData.day_of_week) {
      const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const assignmentDateOnly = new Date(assignmentDate.getFullYear(), assignmentDate.getMonth(), assignmentDate.getDate());

      if (dateOnly >= assignmentDateOnly) {
        const startAt = `${dateStr}T${classData.start_time}:00`;
        const endAt = `${dateStr}T${classData.end_time}:00`;
        sessions.push({
          id: `potential-${dateStr}-${classData.start_time}`,
          start_at: startAt,
          end_at: endAt,
          class_id: null,
          type: 'CLASS',
          isPotential: true,
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}

interface AssignStaffWeekCalendarProps {
  context: AssignStaffContext;
  assignmentDate: string;
  onDateChange?: (date: string) => void;
  staffId?: string;
  staff?: Tables<'staff'>;
  selectedClasses?: ClassWithExpandedSubject[];
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  selectedStaff?: Tables<'staff'>[];
}

export function AssignStaffWeekCalendar({
  context,
  assignmentDate,
  onDateChange: _onDateChange,
  staffId,
  staff: _staff,
  selectedClasses,
  classData,
  classSubject,
  classStaff = [],
  selectedStaff = [],
}: AssignStaffWeekCalendarProps) {
  const assignmentDateObj = useMemo(() => {
    return assignmentDate ? new Date(assignmentDate) : new Date();
  }, [assignmentDate]);

  const [weekAnchor, setWeekAnchor] = useState<Date>(assignmentDateObj);

  useEffect(() => {
    setWeekAnchor(assignmentDateObj);
  }, [assignmentDateObj]);

  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);

  const rangeStartStr = format(weekStart, 'yyyy-MM-dd');
  const rangeEndStr = format(weekEnd, 'yyyy-MM-dd');

  const { data } = useSessionsWithDetails({
    rangeStart: rangeStartStr,
    rangeEnd: rangeEndStr,
    staffId: context === 'staff' ? staffId : undefined,
    classId: context === 'class' ? classData?.id : undefined,
    includeInactive: false,
  });

  // Potential sessions: staff context = selected classes; class context = none
  const potentialSessions = useMemo(() => {
    if (context !== 'staff' || !selectedClasses?.length) return [];

    const all: GeneratedSession[] = [];
    selectedClasses.forEach((c) => {
      if (c.day_of_week === undefined || !c.start_time || !c.end_time) return;
      all.push(
        ...generateClassSessions(
          { day_of_week: c.day_of_week, start_time: c.start_time, end_time: c.end_time },
          weekStart,
          weekEnd,
          assignmentDateObj
        )
      );
    });
    return all;
  }, [context, selectedClasses, weekStart, weekEnd, assignmentDateObj]);

  const allSessions = useMemo(() => {
    const existing = ((data?.sessions as Tables<'sessions'>[]) || []).map((s) => ({
      ...s,
      isPotential: false,
    }));

    if (context === 'staff') {
      return [...existing, ...potentialSessions];
    }

    return existing;
  }, [data?.sessions, context, potentialSessions]);

  const { startHour, slots } = useMemo(() => {
    if (allSessions.length === 0) {
      return { startHour: 9, slots: Array.from({ length: 12 }, (_, i) => 9 + i) };
    }

    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    allSessions.forEach((s) => {
      if (s.start_at) {
        const startMinutes = adelaideTimeToMinutes(s.start_at);
        earliestStart = Math.min(earliestStart, startMinutes);
      }
      if (s.end_at) {
        const endMinutes = adelaideTimeToMinutes(s.end_at);
        latestEnd = Math.max(latestEnd, endMinutes);
      }
    });

    const startHour = Math.max(0, Math.floor(earliestStart / 60) - 1);
    const endHourWithBuffer = latestEnd + 60;
    const endHour = Math.min(23, Math.floor(endHourWithBuffer / 60));
    const slotCount = endHour - startHour + 1;
    const slots = Array.from({ length: slotCount }, (_, i) => startHour + i);

    return { startHour, slots };
  }, [allSessions]);

  const slotHeight = 75;
  const headerHeight = 40;

  const getDaySessions = (d: Date): Array<Tables<'sessions'> | GeneratedSession> => {
    return allSessions.filter((s) => {
      if (!s.start_at) return false;
      return isSameDay(new Date(s.start_at), d);
    });
  };

  const minutesFromStart = (isoString: string) => {
    const minutes = adelaideTimeToMinutes(isoString);
    return minutes - startHour * 60;
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const todayDayIndex = days.findIndex((d) => isSameDay(d, now));
  const currentMinutesFromStart = now.getHours() * 60 + now.getMinutes() - startHour * 60;
  const showTodayIndicator =
    todayDayIndex >= 0 &&
    currentMinutesFromStart >= 0 &&
    currentMinutesFromStart < slots.length * slotHeight;

  const dimmedStaffIds = useMemo(() => {
    if (context === 'class' && classStaff?.length) {
      return new Set(classStaff.map((s) => s.id));
    }
    return undefined;
  }, [context, classStaff]);

  if ((context === 'staff' && !staffId) || (context === 'class' && !classData)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {context === 'staff' ? 'Staff calendar' : 'Class calendar'}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekAnchor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative border rounded-lg">
        <div
          className="grid gap-0 relative bg-background"
          style={{
            gridTemplateColumns: `minmax(80px, 100px) repeat(7, minmax(150px, 1fr))`,
            height: `${headerHeight + slots.length * slotHeight}px`,
          }}
        >
          <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs h-[40px] flex items-center justify-center">
            Time
          </div>
          {days.map((d) => {
            const isToday = isSameDay(d, now);
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm h-[40px] flex items-center justify-center',
                  isToday && 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                )}
              >
                {format(d, 'EEE dd MMM')}
              </div>
            );
          })}

          {slots.map((hour, idx) => (
            <div key={hour} className="contents">
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
                {format(new Date(2000, 0, 1, hour, 0), 'h a')}
              </div>
              {days.map((d) => {
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
                      <div
                        className="absolute inset-0"
                        style={{ height: `${slots.length * slotHeight}px` }}
                      >
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
                          type SessionForDay = Tables<'sessions'> | GeneratedSession;
                          const daySessions = getDaySessions(d)
                            .filter(
                              (s): s is SessionForDay & { start_at: string; end_at: string } =>
                                s.start_at != null && s.end_at != null
                            )
                            .sort(
                              (a, b) =>
                                new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                            );

                          const blocks: JSX.Element[] = [];
                          daySessions.forEach((s) => {
                            const isPotential = 'isPotential' in s && s.isPotential;
                            const sStartMinutes = adelaideTimeToMinutes(s.start_at);
                            const sEndMinutes = adelaideTimeToMinutes(s.end_at);
                            const top = Math.max(
                              0,
                              (minutesFromStart(s.start_at) / 60) * slotHeight
                            );
                            const height = Math.max(
                              30,
                              ((sEndMinutes - sStartMinutes) / 60) * slotHeight
                            );
                            const cardHeight = Math.max(height, 45);
                            const cardWidth = 180;

                            const shouldReduceOpacity =
                              context === 'staff' ? !isPotential : false;

                            const cls: Tables<'classes'> | ClassWithExpandedSubject | undefined =
                              isPotential && selectedClasses?.[0]
                                ? selectedClasses[0]
                                : data?.classesById?.[s.class_id || ''];
                            const subj =
                              cls && 'subject_id' in cls && cls.subject_id
                                ? data?.subjectsById?.[cls.subject_id]
                                : classSubject;

                            let sessionStaff: Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }> =
                              (data?.sessionStaff?.[s.id] as Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>) || [];

                            const sessionDateOnly = s.start_at
                              ? new Date(
                                  new Date(s.start_at).getFullYear(),
                                  new Date(s.start_at).getMonth(),
                                  new Date(s.start_at).getDate()
                                )
                              : null;
                            const assignmentDateOnly = new Date(
                              assignmentDateObj.getFullYear(),
                              assignmentDateObj.getMonth(),
                              assignmentDateObj.getDate()
                            );
                            const isAfterAssignment =
                              sessionDateOnly && sessionDateOnly >= assignmentDateOnly;

                            if (context === 'class' && selectedStaff?.length && isAfterAssignment) {
                              const existingIds = new Set(sessionStaff.map((st) => st.id));
                              const toAdd = selectedStaff.filter((st) => !existingIds.has(st.id));
                              sessionStaff = [
                                ...sessionStaff,
                                ...toAdd.map((st) => ({
                                  ...st,
                                  planned_absence: false,
                                  is_swapped_in: false,
                                })),
                              ];
                            }

                            if (isPotential && selectedClasses?.[0]?.staff) {
                              sessionStaff = selectedClasses[0].staff.map((st) => ({
                                ...st,
                                planned_absence: false,
                                is_swapped_in: false,
                              }));
                            }

                            const sessionStudents =
                              (data?.sessionStudents?.[s.id] as Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>) || [];

                            const mockSession: Tables<'sessions'> = {
                              id: s.id,
                              start_at: s.start_at,
                              end_at: s.end_at,
                              class_id: s.class_id,
                              type: (s.type as 'CLASS' | 'PRIVATE' | 'GROUP') || 'CLASS',
                              created_at: new Date().toISOString(),
                              updated_at: new Date().toISOString(),
                              billing_type: 'CLASS',
                              admin_shift_id: null,
                              status: 'SCHEDULED',
                              subject_id: cls && 'subject_id' in cls ? cls.subject_id : null,
                              is_cancelled: false,
                              cancellation_reason: null,
                              cancellation_notes: null,
                              cancelled_at: null,
                              cancelled_by: null,
                            } as Tables<'sessions'>;

                            blocks.push(
                              <div
                                key={s.id}
                                className={cn('absolute', shouldReduceOpacity && 'opacity-50')}
                                style={{
                                  top: `${top}px`,
                                  height: `${cardHeight}px`,
                                  left: '2.5%',
                                  width: '95%',
                                  zIndex: isPotential ? 20 : 10,
                                  minHeight: '45px',
                                }}
                              >
                                <SessionsCard
                                  session={mockSession}
                                  classData={cls}
                                  subject={subj}
                                  staff={sessionStaff}
                                  students={sessionStudents}
                                  onClick={() => {}}
                                  isCalendarView={true}
                                  cardHeight={cardHeight}
                                  cardWidth={cardWidth}
                                  dimmedStaffIds={dimmedStaffIds}
                                />
                              </div>
                            );
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
