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
  enrollmentDate: string;
  selectedClass: ClassWithExpandedSubject | undefined;
  classData?: Tables<'classes'>;
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
  enrollmentDate,
  selectedClass,
  classData,
  onEnrollmentDateChange,
}: EnrollmentWeekCalendarProps) {
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
  
  // Fetch student sessions
  const { data, isLoading } = useSessionsWithDetails({ 
    rangeStart: rangeStartStr, 
    rangeEnd: rangeEndStr,
    studentId: studentId || undefined,
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

  // Combine student sessions with potential sessions
  const allSessions = useMemo(() => {
    const studentSessions = ((data?.sessions as Tables<'sessions'>[]) || []).map(s => ({
      ...s,
      isPotential: false,
    }));
    
    return [...studentSessions, ...potentialSessions];
  }, [data?.sessions, potentialSessions]);

  // Time grid
  const slots = Array.from({ length: 12 }, (_, i) => 9 + i); // 9..20 hours
  const slotHeight = 75; // px per hour

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
    return minutes - (9 * 60);
  };

  // Current time indicator
  const now = new Date();
  const todayDayIndex = days.findIndex(d => isSameDay(d, now));
  const currentMinutesFromStart = (now.getHours() * 60 + now.getMinutes()) - (9 * 60);
  const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < (slots.length * 75);

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

  if (!studentId) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
            Prev Week
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            Next Week
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </div>
      </div>

      <div className="flex-1 overflow-auto relative border rounded-lg">
        <div
          className="grid gap-0 min-h-[500px] relative bg-background"
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
                          
                          // Separate potential sessions from regular sessions
                          const potentialDaySessions = daySessions.filter((s: any) => s.isPotential);
                          const regularSessions = daySessions.filter((s: any) => !s.isPotential);
                          
                          // Build overlap groups for regular sessions
                          const regularGroups: any[][] = [];
                          const processed = new Set<string>();
                          regularSessions.forEach((s: any) => {
                            if (processed.has(s.id)) return;
                            const group = [s];
                            processed.add(s.id);
                            
                            let foundNewOverlap = true;
                            while (foundNewOverlap) {
                              foundNewOverlap = false;
                              regularSessions.forEach((o: any) => {
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
                            
                            regularGroups.push(group);
                          });
                          
                          const blocks: JSX.Element[] = [];
                          
                          // Render potential sessions FIRST (behind) with special styling
                          potentialDaySessions.forEach((s: any) => {
                            const sStartMinutes = adelaideTimeToMinutes(s.start_at);
                            const sEndMinutes = adelaideTimeToMinutes(s.end_at);
                            const top = Math.max(0, (minutesFromStart(s.start_at) / 60) * slotHeight);
                            const height = Math.max(30, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
                            
                            const cls: any = selectedClass || classData;
                            const subj: any = selectedClass?.subject || (classData ? (data as any)?.subjectsById?.[classData.subject_id] : undefined);
                            
                            blocks.push(
                              <div
                                key={s.id}
                                className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                                style={{ 
                                  top: `${top}px`, 
                                  height: `${height}px`, 
                                  left: '2.5%', 
                                  width: '95%', 
                                  zIndex: 20,
                                  minHeight: '45px'
                                }}
                              >
                                <div className="p-1 h-full flex flex-col justify-center text-xs">
                                  <div className="font-semibold text-primary">
                                    {subj ? (subj.name || 'New Class') : 'New Class'} (New)
                                  </div>
                                  <div className="text-muted-foreground">
                                    {format(new Date(s.start_at), 'h:mm a')} - {format(new Date(s.end_at), 'h:mm a')}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                          
                          // Render regular sessions AFTER (on top) with higher z-index
                          regularGroups.forEach((group) => {
                            const total = group.length;
                            const columnWidth = total > 1 ? 95 / total : 95;
                            group.forEach((s: any, idx: number) => {
                              const sStartMinutes = adelaideTimeToMinutes(s.start_at);
                              const sEndMinutes = adelaideTimeToMinutes(s.end_at);
                              const top = Math.max(0, (minutesFromStart(s.start_at) / 60) * slotHeight);
                              const height = Math.max(30, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
                              const left = (idx * columnWidth) + 2.5;
                              
                              const cls: any = (data as any)?.classesById?.[s.class_id];
                              const subj: any = cls?.subject_id ? (data as any)?.subjectsById?.[cls.subject_id] : undefined;
                              const sessionStudents = ((data as any)?.sessionStudents?.[s.id] || []) as Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>;
                              const sessionStaff = ((data as any)?.sessionStaff?.[s.id] || []) as Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>;
                              
                              const cardHeight = Math.max(height, 45);
                              const estimatedColumnWidth = 180;
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
                                    minHeight: '45px' 
                                  }}
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
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
