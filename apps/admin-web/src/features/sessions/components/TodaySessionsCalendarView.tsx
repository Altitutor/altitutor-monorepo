"use client";

import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';
import { SessionsCard } from './SessionsCard';

type Props = { onOpenSession?: (id: string) => void };

export function TodaySessionsCalendarView({ onOpenSession }: Props) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  const { data } = useSessionsWithDetails({ 
    rangeStart: todayStr, 
    rangeEnd: todayStr,
    includeInactive: false // Only show active sessions in calendar view
  });

  const slotHeight = 75; // px per hour

  const getTodaySessions = (): Tables<'sessions'>[] => {
    const sessions = ((data?.sessions as Tables<'sessions'>[]) || [])
      .filter((s: any) => s.start_at && isSameDay(new Date(s.start_at), today));
    return sessions as Tables<'sessions'>[];
  };

  const todaySessions = getTodaySessions();

  // Calculate dynamic time range based on sessions
  const calculateTimeRange = () => {
    if (todaySessions.length === 0) {
      // Default range if no sessions
      return { startHour: 9, endHour: 20, slots: Array.from({ length: 12 }, (_, i) => 9 + i) };
    }

    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    todaySessions.forEach((s: any) => {
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
    // Calculate end hour: add 60 minutes to latest end time, then get the hour
    const endHourWithBuffer = latestEnd + 60; // Add 1 hour in minutes
    const endHour = Math.min(23, Math.floor(endHourWithBuffer / 60));

    // Generate slots for the range
    const slotCount = endHour - startHour + 1;
    const slots = Array.from({ length: slotCount }, (_, i) => startHour + i);

    return { startHour, endHour, slots };
  };

  const { startHour, slots } = calculateTimeRange();

  // Helpers to compute block positions
  // Use Adelaide timezone for consistent calculations
  const minutesFromStart = (isoString: string) => {
    const minutes = adelaideTimeToMinutes(isoString);
    return minutes - (startHour * 60);
  };

  // Current time indicator
  // For current time indicator, use local time (user's current time)
  const currentMinutesFromStart = (today.getHours() * 60 + today.getMinutes()) - (startHour * 60);
  const totalMinutesInRange = slots.length * 60;
  const showTodayIndicator = currentMinutesFromStart >= 0 && currentMinutesFromStart < totalMinutesInRange;

  if (todaySessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sessions scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto relative">
      <div
        className="grid gap-0 relative bg-background"
        style={{ gridTemplateColumns: `minmax(80px, 100px) 1fr` }}
      >
        {/* Headers */}
        <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">
          Time
        </div>
        <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm bg-blue-50 dark:bg-transparent text-blue-700 dark:text-foreground">
          {format(today, 'EEE dd MMM')}
        </div>

        {/* Rows */}
        {slots.map((hour, idx) => (
          <div key={hour} className="contents">
            <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
              {format(new Date(2000, 0, 1, hour, 0), 'h a')}
            </div>
            <div className="relative border-b border-r h-[75px] bg-blue-50/30 dark:bg-transparent">
              {idx === 0 && (
                <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                  {/* Today indicator line */}
                  {showTodayIndicator && (
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
                    const daySessions = todaySessions.sort(
                      (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                    );
                    // Separate ADMIN_SHIFT sessions from regular sessions
                    // ADMIN_SHIFT sessions are long-duration availability windows and should not be grouped with regular sessions
                    const adminShiftSessions = daySessions.filter((s: any) => s.type === 'ADMIN_SHIFT');
                    const regularSessions = daySessions.filter((s: any) => s.type !== 'ADMIN_SHIFT');
                    
                    // Build overlap groups for regular sessions only (exclude ADMIN_SHIFT)
                    // Fix: Check if session overlaps with ANY session in the group, not just the first one
                    const regularGroups: any[][] = [];
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
                      
                      regularGroups.push(group);
                    });
                    
                    // Create ADMIN_SHIFT groups (one session per group)
                    const adminShiftGroups: any[][] = [];
                    adminShiftSessions.forEach((s: any) => {
                      adminShiftGroups.push([s]);
                    });
                    
                    const blocks: JSX.Element[] = [];
                    
                    // Render ADMIN_SHIFT sessions FIRST (behind) with lower z-index
                    adminShiftGroups.forEach((group) => {
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
                        
                        // Check if session has any students attending (planned attendance)
                        const hasAttendingStudents = sessionStudents.length > 0 && 
                          sessionStudents.some((student) => !student.planned_absence);
                        
                        // Calculate actual pixel dimensions for smart sizing
                        const cardHeight = Math.max(height, 45);
                        // Estimate width: for today view, column is wider, estimate ~400-600px
                        const estimatedColumnWidth = 500; // Approximate column width for today view
                        const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                        
                        blocks.push(
                          <div
                            key={s.id}
                            className={cn("absolute", !hasAttendingStudents && "opacity-50")}
                            style={{
                              top: `${top}px`,
                              height: `${cardHeight}px`,
                              left: `${left}%`,
                              width: `${columnWidth}%`,
                              zIndex: 5,
                              minHeight: '45px',
                            }}
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
                        
                        // Check if session has any students attending (planned attendance)
                        const hasAttendingStudents = sessionStudents.length > 0 && 
                          sessionStudents.some((student) => !student.planned_absence);
                        
                        // Calculate actual pixel dimensions for smart sizing
                        const cardHeight = Math.max(height, 45);
                        // Estimate width: for today view, column is wider, estimate ~400-600px
                        const estimatedColumnWidth = 500; // Approximate column width for today view
                        const cardWidth = (columnWidth / 100) * estimatedColumnWidth;
                        
                        blocks.push(
                          <div
                            key={s.id}
                            className={cn("absolute", !hasAttendingStudents && "opacity-50")}
                            style={{
                              top: `${top}px`,
                              height: `${cardHeight}px`,
                              left: `${left}%`,
                              width: `${columnWidth}%`,
                              zIndex: 10,
                              minHeight: '45px',
                            }}
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
          </div>
        ))}
      </div>
    </div>
  );
}

