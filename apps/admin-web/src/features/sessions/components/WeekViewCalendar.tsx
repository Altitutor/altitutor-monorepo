'use client';

import { useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { StudentSession, RescheduleSession } from '../types/absence';
import { SessionsCard } from './SessionsCard';
import type { Tables } from '@altitutor/shared';

// Base session type that both StudentSession and RescheduleSession share
type BaseSession = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  class_id: string | null;
  type: Tables<'sessions'>['type'] | null;
  subject?: Tables<'subjects'> | null;
  class?: Tables<'classes'> | null;
};

interface WeekViewCalendarProps {
  sessions: BaseSession[];
  selectedSessionIds: Set<string>;
  onToggleSession: (sessionId: string) => void;
  currentWeekStart: Date;
  onWeekChange: (newWeekStart: Date) => void;
  minDate?: Date; // Minimum date (current week start)
}

export function WeekViewCalendar({
  sessions,
  selectedSessionIds,
  onToggleSession,
  currentWeekStart,
  onWeekChange,
  minDate,
}: WeekViewCalendarProps) {
  // Calculate the week days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const startOfWeek = new Date(currentWeekStart);
    // Set to Monday (day 1)
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Group sessions by date (using local timezone, not UTC)
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, BaseSession[]>();
    
    sessions.forEach((session) => {
      if (!session.start_at) return;
      
      const sessionDate = new Date(session.start_at);
      // Use local date components instead of UTC to avoid timezone issues
      const year = sessionDate.getFullYear();
      const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
      const day = String(sessionDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`; // YYYY-MM-DD in local timezone
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(session);
    });
    
    return grouped;
  }, [sessions]);

  // Check if we can go to previous week (Monday-based)
  const canGoPrevious = useMemo(() => {
    if (!minDate) return true;
    const weekStart = new Date(currentWeekStart);
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart >= minDate;
  }, [currentWeekStart, minDate]);

  const handlePreviousWeek = () => {
    if (!canGoPrevious) return;
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    onWeekChange(newWeekStart);
  };

  const handleNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    onWeekChange(newWeekStart);
  };

  const formatDayHeader = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayDate = new Date(date);
    dayDate.setHours(0, 0, 0, 0);
    const isToday = dayDate.getTime() === today.getTime();
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = date.getDate();
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    
    return (
      <div className="text-center pb-2">
        <div className="text-xs text-muted-foreground">{dayName}</div>
        <div className={`text-sm ${isToday ? 'text-primary font-semibold' : ''}`}>
          {dayNumber} {monthName}
        </div>
      </div>
    );
  };

  const getSessionsForDay = (date: Date): BaseSession[] => {
    // Use local date components instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return sessionsByDate.get(dateKey) || [];
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreviousWeek}
          disabled={!canGoPrevious}
          className="p-2"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-sm font-medium">
          {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextWeek}
          className="p-2"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const daySessions = getSessionsForDay(day);

          return (
            <div key={index} className="space-y-2">
              {/* Day Header */}
              {formatDayHeader(day)}
              
              {/* Sessions List */}
              <div className="space-y-2">
                {daySessions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No sessions
                  </div>
                ) : (
                  daySessions.map((session) => {
                    const isSelected = selectedSessionIds.has(session.id);
                    
                    // Convert to Tables<'sessions'> format for SessionsCard
                    const sessionForCard: Tables<'sessions'> = {
                      id: session.id,
                      start_at: session.start_at,
                      end_at: session.end_at,
                      class_id: session.class_id,
                      type: session.type || 'CLASS', // Default to 'CLASS' if null (satisfies type requirement)
                      created_at: null,
                      updated_at: null,
                    } as Tables<'sessions'>;

                    return (
                      <div
                        key={session.id}
                        onClick={() => onToggleSession(session.id)}
                        className={isSelected ? 'ring-2 ring-primary rounded-lg' : ''}
                      >
                        <SessionsCard
                          session={sessionForCard}
                          classData={session.class || undefined}
                          subject={session.subject || undefined}
                          staff={[]}
                          students={[]}
                          isSelecting={true}
                          isSelected={isSelected}
                          compact={true}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

