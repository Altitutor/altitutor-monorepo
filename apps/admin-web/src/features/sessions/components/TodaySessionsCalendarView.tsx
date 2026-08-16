"use client";

import { format, isSameDay, parseISO } from 'date-fns';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';

type SessionsData = {
  classesById?: Record<string, Tables<'classes'>>;
  subjectsById?: Record<string, Tables<'subjects'>>;
  sessionStudents?: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>>;
  sessionStaff?: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>>;
};
import { cn } from '@/shared/utils';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';
import { useElementSize } from '@/shared/hooks/useElementSize';
import { SessionsCard } from './SessionsCard';
import { shouldDimSessionInCalendar } from '../utils/attendanceDerivation';

type Props = {
  date?: string;
  onOpenSession?: (id: string) => void;
};

export function TodaySessionsCalendarView({ date, onOpenSession }: Props) {
  const [dayColumnRef, dayColumnSize] = useElementSize<HTMLDivElement>();
  const selectedDate = date ? parseISO(date) : new Date();
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const today = new Date();
  const isViewingToday = isSameDay(selectedDate, today);
  
  const { data } = useSessionsWithDetails({ 
    rangeStart: selectedDateStr, 
    rangeEnd: selectedDateStr,
    includeInactive: false // Only show active sessions in calendar view
  });

  const slotHeight = 75; // px per hour

  const getTodaySessions = (): Tables<'sessions'>[] => {
    const sessions = ((data?.sessions as Tables<'sessions'>[]) || [])
      .filter((s: Tables<'sessions'>) => s.start_at && isSameDay(new Date(s.start_at), selectedDate));
    return sessions;
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

    todaySessions.forEach((s: Tables<'sessions'>) => {
      if (s.start_at) {
        const startMinutes = adelaideTimeToMinutes(s.start_at);
        earliestStart = Math.min(earliestStart, startMinutes);
      }
      if (s.end_at) {
        const endMinutes = adelaideTimeToMinutes(s.end_at);
        latestEnd = Math.max(latestEnd, endMinutes);
      }
    });

    // Snap to the hour containing the first session start; end at the hour boundary
    // rounded up from the last session end (e.g. 10:30 end → show through 11:00, not 12:00).
    const startHour = Math.max(0, Math.floor(earliestStart / 60));
    const endAtHourBoundary =
      latestEnd % 60 === 0 ? latestEnd / 60 : Math.ceil(latestEnd / 60);
    const endHour = Math.min(23, Math.max(startHour, endAtHourBoundary - 1));

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
  const showTodayIndicator = isViewingToday && currentMinutesFromStart >= 0 && currentMinutesFromStart < totalMinutesInRange;
  const dayColumnWidth = dayColumnSize.width;
  const preferCompactCards = dayColumnWidth > 0 && dayColumnWidth < 520;

  const shouldUseCompactCard = (overlapCount: number, columnWidthPercent: number) => {
    if (preferCompactCards) return true;
    if (dayColumnWidth <= 0) return overlapCount > 1;
    const estimatedCardWidth = (dayColumnWidth * columnWidthPercent) / 100;
    return overlapCount > 1 || estimatedCardWidth < 220;
  };

  if (todaySessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sessions scheduled for this day</p>
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
          {format(selectedDate, 'EEE dd MMM')}
        </div>

        {/* Rows */}
        {slots.map((hour, idx) => (
          <div key={hour} className="contents">
            <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
              {format(new Date(2000, 0, 1, hour, 0), 'h a')}
            </div>
            <div ref={dayColumnRef} className="relative border-b border-r h-[75px] bg-blue-50/30 dark:bg-transparent">
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
                      (a: Tables<'sessions'>, b: Tables<'sessions'>) => new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime()
                    );
                    // Separate ADMIN_SHIFT sessions from regular sessions
                    const adminShiftSessions = daySessions.filter((s: Tables<'sessions'>) => s.type === 'ADMIN_SHIFT');
                    const regularSessions = daySessions.filter((s: Tables<'sessions'>) => s.type !== 'ADMIN_SHIFT');
                    
                    // Build overlap groups for regular sessions only (exclude ADMIN_SHIFT)
                    const regularGroups: Tables<'sessions'>[][] = [];
                    const processed = new Set<string>();
                    regularSessions.forEach((s: Tables<'sessions'>) => {
                      if (processed.has(s.id)) return;
                      const group = [s];
                      processed.add(s.id);
                      
                      // Keep checking for new overlaps until no more sessions can be added
                      let foundNewOverlap = true;
                      while (foundNewOverlap) {
                        foundNewOverlap = false;
                        regularSessions.forEach((o: Tables<'sessions'>) => {
                          if (processed.has(o.id)) return;
                          const oStart = adelaideTimeToMinutes(o.start_at ?? '');
                          const oEnd = adelaideTimeToMinutes(o.end_at ?? '');
                          
                          // Check if o overlaps with ANY session already in the group
                          const overlapsWithGroup = group.some((groupSession: Tables<'sessions'>) => {
                            const gStart = adelaideTimeToMinutes(groupSession.start_at ?? '');
                            const gEnd = adelaideTimeToMinutes(groupSession.end_at ?? '');
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
                    const adminShiftGroups: Tables<'sessions'>[][] = [];
                    adminShiftSessions.forEach((s: Tables<'sessions'>) => {
                      adminShiftGroups.push([s]);
                    });
                    
                    const blocks: JSX.Element[] = [];
                    
                    // Render ADMIN_SHIFT sessions FIRST (behind) with lower z-index
                    const sessionsData = data as SessionsData | undefined;
                    adminShiftGroups.forEach((group) => {
                      const total = group.length;
                      const columnWidth = total > 1 ? 95 / total : 95;
                      group.forEach((s: Tables<'sessions'>, idx: number) => {
                        const sStartMinutes = adelaideTimeToMinutes(s.start_at ?? '');
                        const sEndMinutes = adelaideTimeToMinutes(s.end_at ?? '');
                        const top = Math.max(0, (minutesFromStart(s.start_at ?? '') / 60) * slotHeight);
                        const height = Math.max(30, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
                        const left = (idx * columnWidth) + 2.5;
                        
                        const cls = sessionsData?.classesById?.[s.class_id ?? ''];
                        const subj = cls?.subject_id ? sessionsData?.subjectsById?.[cls.subject_id] : undefined;
                        const sessionStudents = sessionsData?.sessionStudents?.[s.id] || [];
                        const sessionStaff = sessionsData?.sessionStaff?.[s.id] || [];
                        
                        const cardHeight = Math.max(height, 45);
                        const cardWidth =
                          dayColumnWidth > 0
                            ? (dayColumnWidth * columnWidth) / 100
                            : columnWidth;
                        const useCompact = shouldUseCompactCard(total, columnWidth);
                        
                        blocks.push(
                          <div
                            key={s.id}
                            className={cn("absolute", shouldDimSessionInCalendar(sessionStudents) && "opacity-50")}
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
                              compact={useCompact}
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
                      group.forEach((s: Tables<'sessions'>, idx: number) => {
                        const sStartMinutes = adelaideTimeToMinutes(s.start_at ?? '');
                        const sEndMinutes = adelaideTimeToMinutes(s.end_at ?? '');
                        const top = Math.max(0, (minutesFromStart(s.start_at ?? '') / 60) * slotHeight);
                        const height = Math.max(30, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
                        const left = (idx * columnWidth) + 2.5;
                        
                        const cls = sessionsData?.classesById?.[s.class_id ?? ''];
                        const subj = cls?.subject_id ? sessionsData?.subjectsById?.[cls.subject_id] : undefined;
                        const sessionStudents = (sessionsData?.sessionStudents?.[s.id] ?? []) as Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>;
                        const sessionStaff = (sessionsData?.sessionStaff?.[s.id] ?? []) as Array<Tables<'staff'> & { planned_absence?: boolean; is_swapped_in?: boolean }>;
                        
                        const cardHeight = Math.max(height, 45);
                        const cardWidth =
                          dayColumnWidth > 0
                            ? (dayColumnWidth * columnWidth) / 100
                            : columnWidth;
                        const useCompact = shouldUseCompactCard(total, columnWidth);
                        
                        blocks.push(
                          <div
                            key={s.id}
                            className={cn("absolute", shouldDimSessionInCalendar(sessionStudents) && "opacity-50")}
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
                              compact={useCompact}
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
