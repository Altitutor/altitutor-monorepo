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
  // Change class mode props
  oldClass?: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  oldClassStaff?: Tables<'staff'>[];
  isChangeClassMode?: boolean;
  // Unenroll mode props
  isUnenrollMode?: boolean;
  unenrollingClassId?: string;
  finalSessionDate?: string; // The final session date (not the unenrollment date which is day after)
}

interface GeneratedSession {
  id: string;
  start_at: string;
  end_at: string;
  class_id: string | null;
  type: string;
  isPotential: boolean; // true for potential new class sessions
  isOldClass?: boolean; // true for old class sessions in change class mode
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
  classStaff: _classStaff = [],
  onEnrollmentDateChange: _onEnrollmentDateChange,
  oldClass,
  oldClassSubject,
  oldClassStaff = [],
  isChangeClassMode = false,
  isUnenrollMode = false,
  unenrollingClassId,
  finalSessionDate,
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
  const { data } = useSessionsWithDetails({ 
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

  // Generate potential old class sessions (for change class mode)
  // Only show sessions BEFORE the changeover date
  const potentialOldClassSessions = useMemo(() => {
    if (!isChangeClassMode || !oldClass || oldClass.day_of_week === undefined || !oldClass.start_time || !oldClass.end_time) {
      return [];
    }
    
    // Generate sessions for the old class, but only up to (but not including) the changeover date
    const changeoverDateOnly = new Date(enrollmentDateObj.getFullYear(), enrollmentDateObj.getMonth(), enrollmentDateObj.getDate());
    
    // Generate sessions from weekStart to changeoverDate (exclusive)
    const sessions: GeneratedSession[] = [];
    const currentDate = new Date(weekStart);
    
    while (currentDate < changeoverDateOnly && currentDate <= weekEnd) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      // Check if this day matches the old class day_of_week
      if (dayOfWeek === oldClass.day_of_week) {
        const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        
        // Only include sessions before changeover date
        if (dateOnly < changeoverDateOnly) {
          const startAt = `${dateStr}T${oldClass.start_time}:00`;
          const endAt = `${dateStr}T${oldClass.end_time}:00`;
          
          sessions.push({
            id: `old-class-${dateStr}-${oldClass.start_time}`,
            start_at: startAt,
            end_at: endAt,
            class_id: oldClass.id,
            type: 'CLASS',
            isPotential: true,
            isOldClass: true, // Mark as old class session
          });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return sessions;
  }, [isChangeClassMode, oldClass, weekStart, weekEnd, enrollmentDateObj]);

  // Combine sessions with potential sessions
  // In class context: show all class sessions (no potential sessions needed, they're already there)
  // In student context: show student sessions + potential class sessions
  // In change class mode: filter out old class sessions on or after changeover date
  // In unenroll mode: filter out unenrolling class sessions after unenrollment date
  const allSessions = useMemo(() => {
    const existingSessions = ((data?.sessions as Tables<'sessions'>[]) || []).map(s => ({
      ...s,
      isPotential: false,
    }));
    
    let filteredSessions = existingSessions;
    
    // In unenroll mode, filter out unenrolling class sessions after final session date
    if (isUnenrollMode && unenrollingClassId && finalSessionDate) {
      // Parse final session date and normalize to date-only (midnight in local time)
      const finalSessionDateParts = finalSessionDate.split('-');
      const finalSessionDateOnly = new Date(
        parseInt(finalSessionDateParts[0], 10),
        parseInt(finalSessionDateParts[1], 10) - 1, // Month is 0-indexed
        parseInt(finalSessionDateParts[2], 10)
      );
      
      filteredSessions = existingSessions.filter((s) => {
        // If session belongs to unenrolling class, only show if it's on or before final session date
        if (s.class_id === unenrollingClassId) {
          const sessionDate = s.start_at ? new Date(s.start_at) : null;
          if (sessionDate) {
            const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
            // Compare dates - include sessions on or before the final session date
            return sessionDateOnly.getTime() <= finalSessionDateOnly.getTime();
          }
          return false; // No start_at, filter out
        }
        // Keep all other sessions (other classes)
        return true;
      });
    }
    
    // In change class mode, filter out old class sessions on or after changeover date
    if (isChangeClassMode && oldClass) {
      const changeoverDateOnly = new Date(enrollmentDateObj.getFullYear(), enrollmentDateObj.getMonth(), enrollmentDateObj.getDate());
      
      filteredSessions = filteredSessions.filter((s) => {
        // If session belongs to old class, only show if it's before changeover date
        if (s.class_id === oldClass.id) {
          const sessionDate = s.start_at ? new Date(s.start_at) : null;
          if (sessionDate) {
            const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
            return sessionDateOnly < changeoverDateOnly;
          }
          return false; // No start_at, filter out
        }
        // Keep all other sessions (other classes)
        return true;
      });
    }
    
    // Only add potential sessions in student context (not in unenroll mode)
    if (!isClassContext && !isUnenrollMode) {
      // In change class mode, also add old class potential sessions
      if (isChangeClassMode) {
        return [...filteredSessions, ...potentialSessions, ...potentialOldClassSessions];
      }
      return [...filteredSessions, ...potentialSessions];
    }
    
    return filteredSessions;
  }, [data?.sessions, potentialSessions, potentialOldClassSessions, isClassContext, isChangeClassMode, isUnenrollMode, unenrollingClassId, finalSessionDate, oldClass, enrollmentDateObj]);

  // Calculate dynamic time range based on sessions
  const { startHour, slots } = useMemo(() => {
    if (allSessions.length === 0) {
      // Default range if no sessions
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

    // Add 1 hour buffer before earliest and after latest
    const startHour = Math.max(0, Math.floor(earliestStart / 60) - 1);
    const endHourWithBuffer = latestEnd + 60; // Add 1 hour in minutes
    const endHour = Math.min(23, Math.floor(endHourWithBuffer / 60));

    // Generate slots for the range
    const slotCount = endHour - startHour + 1;
    const slots = Array.from({ length: slotCount }, (_, i) => startHour + i);

    return { startHour, slots };
  }, [allSessions]);

  const slotHeight = 75; // px per hour
  const headerHeight = 40; // px for header row

  const getDaySessions = (d: Date): Array<Tables<'sessions'> | GeneratedSession> => {
    return allSessions.filter((s) => {
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {isClassContext ? 'Class calendar' : 'Student calendar'}
        </h3>
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
                          type SessionForDay = Tables<'sessions'> | GeneratedSession;
                          const daySessions = getDaySessions(d).filter((s): s is SessionForDay & { start_at: string; end_at: string } => 
                            s.start_at !== null && s.end_at !== null
                          ).sort((a, b) => 
                            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                          );
                          
                          // Build overlap groups for ALL sessions (including potential)
                          const allGroups: SessionForDay[][] = [];
                          const processed = new Set<string>();
                          
                          daySessions.forEach((s) => {
                            if (processed.has(s.id)) return;
                            const group: SessionForDay[] = [s];
                            processed.add(s.id);
                            
                            let foundNewOverlap = true;
                            while (foundNewOverlap) {
                              foundNewOverlap = false;
                              daySessions.forEach((o) => {
                                if (processed.has(o.id)) return;
                                if (!o.start_at || !o.end_at) return;
                                const oStart = adelaideTimeToMinutes(o.start_at);
                                const oEnd = adelaideTimeToMinutes(o.end_at);
                                
                                const overlapsWithGroup = group.some((groupSession) => {
                                  if (!groupSession.start_at || !groupSession.end_at) return false;
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
                            group.forEach((s, idx: number) => {
                              const sStartMinutes = adelaideTimeToMinutes(s.start_at!);
                              const sEndMinutes = adelaideTimeToMinutes(s.end_at!);
                              const top = Math.max(0, (minutesFromStart(s.start_at!) / 60) * slotHeight);
                              const height = Math.max(30, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
                              const left = (idx * columnWidth) + 2.5;
                              
                              const isPotential = 'isPotential' in s && s.isPotential;
                              
                              // For potential sessions, use selectedClass/classData
                              // For old class potential sessions, use oldClass
                              // For regular sessions, use data from query
                              const isOldClassSession = 'isOldClass' in s && s.isOldClass === true;
                              const cls: Tables<'classes'> | ClassWithExpandedSubject | undefined = isOldClassSession
                                ? oldClass
                                : isPotential 
                                  ? (selectedClass || classData)
                                  : (data?.classesById?.[s.class_id || '']);
                              const subj: Tables<'subjects'> | undefined = isOldClassSession
                                ? (oldClassSubject || (oldClass && oldClass.subject_id ? data?.subjectsById?.[oldClass.subject_id] : undefined))
                                : isPotential
                                  ? (selectedClass?.subject || (classData && classData.subject_id ? data?.subjectsById?.[classData.subject_id] : undefined))
                                  : (cls && 'subject_id' in cls && cls.subject_id ? data?.subjectsById?.[cls.subject_id] : undefined);
                              
                              // Get session date to check if student should be included
                              const sessionDate = s.start_at ? new Date(s.start_at) : null;
                              const sessionDateOnly = sessionDate ? new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()) : null;
                              const enrollmentDateOnly = new Date(enrollmentDateObj.getFullYear(), enrollmentDateObj.getMonth(), enrollmentDateObj.getDate());
                              const isAfterEnrollmentDate = sessionDateOnly && sessionDateOnly >= enrollmentDateOnly;
                              
                              // For potential sessions: include staff/students from class
                              // For regular sessions: get from query data
                              let sessionStudents: Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }> = [];
                              let sessionStaff: Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }> = [];
                              
                              if (isPotential || isOldClassSession) {
                                // Potential sessions: get staff/students from class data
                                if (isOldClassSession) {
                                  // Old class sessions: get staff/students from oldClassStaff prop or oldClass
                                  if (oldClassStaff && oldClassStaff.length > 0) {
                                    sessionStaff = oldClassStaff.map(staff => ({
                                      ...staff,
                                      planned_absence: false,
                                      is_swapped_in: false,
                                    }));
                                  } else if (oldClassStaff && oldClassStaff.length > 0) {
                                    sessionStaff = oldClassStaff.map((staff) => ({
                                      ...staff,
                                      planned_absence: false,
                                      is_swapped_in: false,
                                    }));
                                  }
                                  // For old class, we need to get students from the query if available
                                  // But since these are potential sessions, we'll show empty students or get from query
                                  const existingStudents = ((data as any)?.sessionStudents?.[s.id] || []) as Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>;
                                  sessionStudents = existingStudents;
                                } else if (isClassContext) {
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
                              
                              // Determine opacity: 
                              // - In student context: reduce opacity for existing sessions (not potential), full opacity for potential sessions
                              // - In class context: full opacity for all sessions
                              // - In change class mode: reduce opacity for old class sessions
                              const shouldReduceOpacity = isClassContext 
                                ? false // Don't reduce card opacity in class context, we'll handle student/staff opacity individually
                                : isOldClassSession || (isChangeClassMode && !isPotential && s.class_id === oldClass?.id)
                                  ? true // In change class mode, reduce opacity for old class sessions
                                  : !isPotential; // In student context, reduce opacity for regular sessions (existing student sessions)
                              
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
                                    
                                    // Convert potential session to a session-like object for SessionsCard
                                    if ('isPotential' in s && s.isPotential) {
                                      // Get subject_id from class or subject
                                      const subjectId = cls && 'subject_id' in cls && cls.subject_id
                                        ? cls.subject_id
                                        : subj?.id || null;
                                      
                                      // Create a mock session object for potential sessions
                                      const mockSession: Tables<'sessions'> = {
                                        id: s.id,
                                        start_at: s.start_at,
                                        end_at: s.end_at,
                                        class_id: s.class_id,
                                        type: s.type as 'CLASS' | 'PRIVATE' | 'GROUP',
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                        billing_type: 'CLASS',
                                        admin_shift_id: null,
                                        status: 'SCHEDULED',
                                        subject_id: subjectId,
                                        is_cancelled: false,
                                        cancellation_reason: null,
                                        cancellation_notes: null,
                                        cancelled_at: null,
                                        cancelled_by: null,
                                      } as Tables<'sessions'>;
                                      
                                      return (
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
                                          dimmedStudentIds={dimmedStudentIds}
                                          dimmedStaffIds={dimmedStaffIds}
                                        />
                                      );
                                    }
                                    
                                    return (
                                      <SessionsCard
                                        session={s as Tables<'sessions'>}
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
