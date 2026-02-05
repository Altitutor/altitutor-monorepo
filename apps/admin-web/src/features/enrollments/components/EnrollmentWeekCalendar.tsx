'use client';

import { useMemo, useState, useEffect } from 'react';
import { addDays, startOfWeek, endOfWeek, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { Button } from '@altitutor/ui';

interface EnrollmentWeekCalendarProps {
  studentId: string | null;
  selectedStudent?: Tables<'students'>;
  enrollmentDate: string;
  selectedClass: ClassWithExpandedSubject | undefined;
  classData?: Tables<'classes'>;
  classStaff?: Tables<'staff'>[];
  onEnrollmentDateChange?: (date: string) => void;
}

interface GeneratedSession {
  id: string;
  start_at: string;
  end_at: string;
  class_id: string | null;
  type: string;
  isPotential: boolean; // true for potential new class sessions
}

/**
 * Generate potential sessions for a class within a date range
 */
function generateClassSessions(
  classData: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'>,
  weekStart: Date,
  weekEnd: Date,
  enrollmentDate: Date
): GeneratedSession[] {
  const sessions: GeneratedSession[] = [];
  const currentDate = new Date(weekStart);
  
  while (currentDate <= weekEnd) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    // Check if this day matches the class day_of_week
    if (dayOfWeek === classData.day_of_week) {
      // Only include sessions on or after enrollment date
      const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const enrollmentDateOnly = new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth(), enrollmentDate.getDate());
      
      if (dateOnly >= enrollmentDateOnly) {
        // Build ISO timestamps
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

export function EnrollmentWeekCalendar({
  studentId,
  selectedStudent,
  enrollmentDate,
  selectedClass,
  classData,
  classStaff = [],
  onEnrollmentDateChange,
}: EnrollmentWeekCalendarProps) {
  // Determine context: if classData exists, we're in class context
  const isClassContext = !!classData;
  
  // Calculate week start/end from enrollment date
  const enrollmentDateObj = useMemo(() => {
    return enrollmentDate ? new Date(enrollmentDate) : new Date();
  }, [enrollmentDate]);

  const [weekAnchor, setWeekAnchor] = useState<Date>(enrollmentDateObj);
  
  // Update week anchor when enrollment date changes
  useEffect(() => {
    setWeekAnchor(enrollmentDateObj);
  }, [enrollmentDateObj]);

  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  
  const rangeStartStr = format(weekStart, 'yyyy-MM-dd');
  const rangeEndStr = format(weekEnd, 'yyyy-MM-dd');
  
  // Fetch sessions: by classId in class context, by studentId in student context
  const { data, isLoading } = useSessionsWithDetails({ 
    rangeStart: rangeStartStr, 
    rangeEnd: rangeEndStr,
    studentId: isClassContext ? undefined : (studentId || undefined),
    classId: isClassContext ? (classData?.id || undefined) : undefined,
    includeInactive: false
  });
  
  // Generate potential new class sessions
  const potentialSessions = useMemo(() => {
    if (!selectedClass && !classData) {
      return [];
    }
    
    const classToUse = selectedClass || classData;
    if (!classToUse || classToUse.day_of_week === undefined || !classToUse.start_time || !classToUse.end_time) {
      return [];
    }
    
    return generateClassSessions(
      {
        day_of_week: classToUse.day_of_week,
        start_time: classToUse.start_time,
        end_time: classToUse.end_time,
      },
      weekStart,
      weekEnd,
      enrollmentDateObj
    );
  }, [selectedClass, classData, weekStart, weekEnd, enrollmentDateObj]);

  // Combine sessions with potential sessions
  // In class context: show all class sessions (no potential sessions needed, they're already there)
  // In student context: show student sessions + potential class sessions
  const allSessions = useMemo(() => {
    const existingSessions = ((data?.sessions as Tables<'sessions'>[]) || []).map(s => ({
      ...s,
      isPotential: false,
    }));
    
    // Only add potential sessions in student context
    if (!isClassContext) {
      return [...existingSessions, ...potentialSessions];
    }
    
    return existingSessions;
  }, [data?.sessions, potentialSessions, isClassContext]);

  // Calculate dynamic time range based on sessions
  const { startHour, endHour, slots } = useMemo(() => {
    if (allSessions.length === 0) {
      // Default range if no sessions
      return { startHour: 9, endHour: 20, slots: Array.from({ length: 12 }, (_, i) => 9 + i) };
    }

    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    allSessions.forEach((s: any) => {
      if (s.start_at) {
        const startMinutes = adelaideTimeToMinutes(s.start_at);
        earliestStart = Math.min(earliestStart, startMinutes);
      }
      if (s.end_at) {
        const endMinutes = adelaideTimeToMinutes(s.end_at);
        latestEnd = Math.max(latestEnd, endMinutes);
      }
    });

    // Add 1 hour buffer before earliest and after latest
    const startHour = Math.max(0, Math.floor(earliestStart / 60) - 1);
    const endHourWithBuffer = latestEnd + 60; // Add 1 hour in minutes
    const endHour = Math.min(23, Math.floor(endHourWithBuffer / 60));

    // Generate slots for the range
    const slotCount = endHour - startHour + 1;
    const slots = Array.from({ length: slotCount }, (_, i) => startHour + i);

    return { startHour, endHour, slots };
  }, [allSessions]);

  const slotHeight = 75; // px per hour
  const headerHeight = 40; // px for header row

  const getDaySessions = (d: Date): Array<Tables<'sessions'> | GeneratedSession> => {
    return allSessions.filter((s: any) => {
      if (!s.start_at) return false;
      return isSameDay(new Date(s.start_at), d);
    });
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Helpers to compute block positions
  const minutesFromStart = (isoString: string) => {
    const minutes = adelaideTimeToMinutes(isoString);
    return minutes - (startHour * 60);
  };

  // Current time indicator
  const now = new Date();
  const todayDayIndex = days.findIndex(d => isSameDay(d, now));
  const currentMinutesFromStart = (now.getHours() * 60 + now.getMinutes()) - (startHour * 60);
  const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < (slots.length * slotHeight);

  const handlePrevWeek = () => {
    setWeekAnchor(addDays(weekAnchor, -7));
  };

  const handleNextWeek = () => {
    setWeekAnchor(addDays(weekAnchor, 7));
  };

  const handleToday = () => {
    const today = new Date();
    setWeekAnchor(today);
  };

  // Show calendar if we have classData (class context) or studentId (student context)
  if (!classData && !studentId) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative border rounded-lg">
        <div
          className="grid gap-0 relative bg-background"
          style={{ 
            gridTemplateColumns: `minmax(80px, 100px) repeat(7, minmax(150px, 1fr))`,
            height: `${headerHeight + slots.length * slotHeight}px`
          }}
        >
          {/* Headers */}
          <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs h-[40px] flex items-center justify-center">Time</div>
          {days.map((d) => {
            const isToday = isSameDay(d, now);
            return (
              <div key={d.toISOString()} className={cn(
                "sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm h-[40px] flex items-center justify-center",
                isToday && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
              )}>
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
                          const daySessions = getDaySessions(d).sort((a: any, b: any) => 
                            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                          );
                          
                          // Build overlap groups for ALL sessions (including potential)
                          const allGroups: any[][] = [];
                          const processed = new Set<string>();
                          
                          daySessions.forEach((s: any) => {
                            if (processed.has(s.id)) return;
                            const group = [s];
                            processed.add(s.id);
                            
                            let foundNewOverlap = true;
                            while (foundNewOverlap) {
                              foundNewOverlap = false;
                              daySessions.forEach((o: any) => {
                                if (processed.has(o.id)) return;
                                const oStart = adelaideTimeToMinutes(o.start_at);
                                const oEnd = adelaideTimeToMinutes(o.end_at);
                                
                                const overlapsWithGroup = group.some((groupSession: any) => {
                                  const gStart = adelaideTimeToMinutes(groupSession.start_at);
                                  const gEnd = adelaideTimeToMinutes(groupSession.end_at);
                                  return gStart < oEnd && gEnd > oStart;
                                });
                                
                                if (overlapsWithGroup) {
                                  group.push(o);
                                  processed.add(o.id);
                                  foundNewOverlap = true;
                                }
                              });
                            }
                            
                            allGroups.push(group);
                          });
                          
                          const blocks: JSX.Element[] = [];
                          
                          // Render all sessions (potential and regular) together
                          allGroups.forEach((group) => {
                            const total = group.length;
                            const columnWidth = total > 1 ? 95 / total : 95;
                            group.forEach((s: any, idx: number) => {
                              const sStartMinutes = adelaideTimeToMinutes(s.start_at);
                              const sEndMinutes = adelaideTimeToMinutes(s.end_at);
                              const top = Math.max(0, (minutesFromStart(s.start_at) / 60) * slotHeight);
                              const height = Math.max(30, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
                              const left = (idx * columnWidth) + 2.5;
                              
                              const isPotential = s.isPotential;
                              
                              // For potential sessions, use selectedClass/classData
                              // For regular sessions, use data from query
                              const cls: any = isPotential 
                                ? (selectedClass || classData)
                                : ((data as any)?.classesById?.[s.class_id]);
                              const subj: any = isPotential
                                ? (selectedClass?.subject || (classData ? (data as any)?.subjectsById?.[classData.subject_id] : undefined))
                                : (cls?.subject_id ? (data as any)?.subjectsById?.[cls.subject_id] : undefined);
                              
                              // Get session date to check if student should be included
                              const sessionDate = s.start_at ? new Date(s.start_at) : null;
                              const sessionDateOnly = sessionDate ? new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()) : null;
                              const enrollmentDateOnly = new Date(enrollmentDateObj.getFullYear(), enrollmentDateObj.getMonth(), enrollmentDateObj.getDate());
                              const isAfterEnrollmentDate = sessionDateOnly && sessionDateOnly >= enrollmentDateOnly;
                              
                              // For potential sessions: include staff/students from class
                              // For regular sessions: get from query data
                              let sessionStudents: Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }> = [];
                              let sessionStaff: Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }> = [];
                              
                              if (isPotential) {
                                // Potential sessions: get staff/students from class data
                                if (isClassContext) {
                                  // Class context: get existing students/staff from query, add potential student if after enrollment date
                                  const existingStudents = ((data as any)?.sessionStudents?.[s.id] || []) as Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>;
                                  const existingStaff = ((data as any)?.sessionStaff?.[s.id] || []) as Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>;
                                  
                                  // Add potential student if session is after enrollment date
                                  if (isAfterEnrollmentDate && selectedStudent) {
                                    sessionStudents = [
                                      ...existingStudents,
                                      {
                                        ...selectedStudent,
                                        planned_absence: false,
                                        is_extra: false,
                                      }
                                    ];
                                  } else {
                                    sessionStudents = existingStudents;
                                  }
                                  
                                  // Use existing staff from query
                                  sessionStaff = existingStaff;
                                } else {
                                  // Student context: get staff/students from selectedClass
                                  if (selectedClass?.staff) {
                                    sessionStaff = selectedClass.staff.map(staff => ({
                                      ...staff,
                                      planned_absence: false,
                                      is_swapped_in: false,
                                    }));
                                  }
                                  if (selectedClass?.students) {
                                    sessionStudents = selectedClass.students.map(student => ({
                                      ...student,
                                      planned_absence: false,
                                      is_extra: false,
                                    }));
                                  }
                                }
                              } else {
                                // Regular sessions: get from query data
                                const existingStudents = ((data as any)?.sessionStudents?.[s.id] || []) as Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>;
                                const existingStaff = ((data as any)?.sessionStaff?.[s.id] || []) as Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>;
                                
                                if (isClassContext) {
                                  // Class context: add potential student if session is after enrollment date
                                  if (isAfterEnrollmentDate && selectedStudent) {
                                    // Check if student is already in the list
                                    const studentExists = existingStudents.some(st => st.id === selectedStudent.id);
                                    if (!studentExists) {
                                      sessionStudents = [
                                        ...existingStudents,
                                        {
                                          ...selectedStudent,
                                          planned_absence: false,
                                          is_extra: false,
                                        }
                                      ];
                                    } else {
                                      sessionStudents = existingStudents;
                                    }
                                  } else {
                                    sessionStudents = existingStudents;
                                  }
                                  sessionStaff = existingStaff;
                                } else {
                                  // Student context: use existing data as-is
                                  sessionStudents = existingStudents;
                                  sessionStaff = existingStaff;
                                }
                              }
                              
                              const cardHeight = Math.max(height, 45);
                              const estimatedColumnWidth = 180;
                              const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                              
                              // Determine opacity: in class context, reduce opacity for other students/staff
                              // In student context, reduce opacity for regular sessions
                              const shouldReduceOpacity = isClassContext 
                                ? false // Don't reduce card opacity in class context, we'll handle student/staff opacity individually
                                : !isPotential; // In student context, reduce opacity for regular sessions
                              
                              blocks.push(
                                <div
                                  key={s.id}
                                  className={cn(
                                    "absolute",
                                    shouldReduceOpacity && "opacity-50"
                                  )}
                                  style={{ 
                                    top: `${top}px`, 
                                    height: `${cardHeight}px`, 
                                    left: `${left}%`, 
                                    width: `${columnWidth}%`, 
                                    zIndex: isPotential ? 20 : 10, // Potential sessions on top
                                    minHeight: '45px' 
                                  }}
                                >
                                  {/* In class context, dim all students/staff except potential student */}
                                  {(() => {
                                    // In class context:
                                    // - Sessions before enrollment date: dim all students and all staff
                                    // - Sessions after enrollment date: dim all students except potential one, dim all staff
                                    const dimmedStudentIds = isClassContext
                                      ? new Set(
                                          isAfterEnrollmentDate && selectedStudent
                                            ? sessionStudents.filter(st => st.id !== selectedStudent.id).map(st => st.id)
                                            : sessionStudents.map(st => st.id)
                                        )
                                      : undefined;
                                    const dimmedStaffIds = isClassContext
                                      ? new Set(sessionStaff.map(st => st.id))
                                      : undefined;
                                    
                                    return (
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
                                        dimmedStudentIds={dimmedStudentIds}
                                        dimmedStaffIds={dimmedStaffIds}
                                      />
                                    );
                                  })()}
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
