"use client";

import { useMemo, useState } from 'react';
import { addDays, startOfWeek, endOfWeek, format, differenceInMinutes, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { Button } from "@altitutor/ui";

interface StudentSessionsCalendarViewProps {
  studentId: string;
  onOpenSession?: (id: string) => void;
  classId?: string;
}

export function StudentSessionsCalendarView({ 
  studentId, 
  onOpenSession,
  classId 
}: StudentSessionsCalendarViewProps) {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => endOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  
  // #region agent log
  const rangeStartStr = format(weekStart, 'yyyy-MM-dd');
  const rangeEndStr = format(weekEnd, 'yyyy-MM-dd');
  // #endregion
  
  const { data, isLoading, error } = useSessionsWithDetails({ 
    rangeStart: rangeStartStr, 
    rangeEnd: rangeEndStr,
    studentId,
    classId,
    includeInactive: false // Only show active sessions in calendar view
  });
  
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentSessionsCalendarView.tsx:32',message:'useSessionsWithDetails result',data:{rangeStart:rangeStartStr,rangeEnd:rangeEndStr,studentId,classId,hasData:!!data,sessionsCount:data?.sessions?.length||0,isLoading,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion

  // Time grid similar to classes timetable
  const slots = Array.from({ length: 12 }, (_, i) => 9 + i); // 9..20 hours
  const slotHeight = 75; // px per hour

  const getDaySessions = (d: Date): Tables<'sessions'>[] => {
    const allSessions = (data?.sessions as Tables<'sessions'>[]) || [];
    // #region agent log
    if (typeof window !== 'undefined') {
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StudentSessionsCalendarView.tsx:42',message:'getDaySessions called',data:{day:format(d,'yyyy-MM-dd'),allSessionsCount:allSessions.length,daySessionsCount:allSessions.filter((s:any)=>s.start_at&&isSameDay(new Date(s.start_at),d)).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
    const sessions = allSessions
      .filter((s: any) => s.start_at && isSameDay(new Date(s.start_at), d));
    return sessions as Tables<'sessions'>[];
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Helpers to compute block positions
  // Use Adelaide timezone for consistent calculations
  const minutesFromStart = (isoString: string) => {
    const minutes = adelaideTimeToMinutes(isoString);
    return minutes - (9 * 60);
  };

  // Current time indicator
  const now = new Date();
  const todayDayIndex = days.findIndex(d => isSameDay(d, now));
  // For current time indicator, use local time (user's current time)
  const currentMinutesFromStart = (now.getHours() * 60 + now.getMinutes()) - (9 * 60);
  const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < (slots.length * 75);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto relative">
        <div
          className="grid gap-0 min-h-full relative bg-background"
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
                        const daySessions = getDaySessions(d).sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
                        // Separate ADMIN_SHIFT sessions from regular sessions
                        // ADMIN_SHIFT sessions are long-duration availability windows and should not be grouped with regular sessions
                        const adminShiftSessions = daySessions.filter((s: any) => s.type === 'ADMIN_SHIFT');
                        const regularSessions = daySessions.filter((s: any) => s.type !== 'ADMIN_SHIFT');
                        
                        // Build overlap groups for regular sessions only (exclude ADMIN_SHIFT)
                        // Fix: Check if session overlaps with ANY session in the group, not just the first one
                        const groups: any[][] = [];
                        const processed = new Set<string>();
                        regularSessions.forEach((s: any) => {
                          if (processed.has(s.id)) return;
                          const group = [s];
                          processed.add(s.id);
                          
                          // Keep checking for new overlaps until no more sessions can be added
                          let foundNewOverlap = true;
                          while (foundNewOverlap) {
                            foundNewOverlap = false;
                            regularSessions.forEach((o: any) => {
                              if (processed.has(o.id)) return;
                              const oStart = adelaideTimeToMinutes(o.start_at);
                              const oEnd = adelaideTimeToMinutes(o.end_at);
                              
                              // Check if o overlaps with ANY session already in the group
                              const overlapsWithGroup = group.some((groupSession: any) => {
                                const gStart = adelaideTimeToMinutes(groupSession.start_at);
                                const gEnd = adelaideTimeToMinutes(groupSession.end_at);
                                // Events that end exactly when another starts should NOT overlap
                                // Use strict comparison: gStart < oEnd && gEnd > oStart
                                return gStart < oEnd && gEnd > oStart;
                              });
                              
                              if (overlapsWithGroup) {
                                group.push(o);
                                processed.add(o.id);
                                foundNewOverlap = true;
                              }
                            });
                          }
                          
                          groups.push(group);
                        });
                        
                        // Add ADMIN_SHIFT sessions as individual groups (one session per group)
                        adminShiftSessions.forEach((s: any) => {
                          groups.push([s]);
                        });
                        const blocks: JSX.Element[] = [];
                        groups.forEach((group) => {
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
                            
                            // Calculate actual pixel dimensions for smart sizing
                            const cardHeight = Math.max(height, 45);
                            // Estimate width: assume column is ~150-200px wide, calculate from percentage
                            const estimatedColumnWidth = 180; // Approximate column width for week view
                            const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                            
                            blocks.push(
                              <div
                                key={s.id}
                                className="absolute"
                                style={{ top: `${top}px`, height: `${cardHeight}px`, left: `${left}%`, width: `${columnWidth}%`, zIndex: 10, minHeight: '45px' }}
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
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
