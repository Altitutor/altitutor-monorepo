'use client';

import { useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { StudentSession, RescheduleSession } from '../types/absence';
import { Calendar, BookOpen } from 'lucide-react';

// Base session type that both StudentSession and RescheduleSession share
type BaseSession = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  subject?: {
    curriculum?: string | null;
    year_level?: number | null;
    name?: string | null;
    level?: string | null;
  } | null;
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
  // Calculate the week days (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const startOfWeek = new Date(currentWeekStart);
    // Set to Sunday
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, BaseSession[]>();
    
    sessions.forEach((session) => {
      if (!session.start_at) return;
      
      const sessionDate = new Date(session.start_at);
      const dateKey = sessionDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(session);
    });
    
    return grouped;
  }, [sessions]);

  // Check if we can go to previous week
  const canGoPrevious = useMemo(() => {
    if (!minDate) return true;
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
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
      <div className={`text-center pb-2 ${isToday ? 'font-bold text-primary' : ''}`}>
        <div className="text-xs text-muted-foreground">{dayName}</div>
        <div className={`text-sm ${isToday ? 'text-primary' : ''}`}>
          {dayNumber} {monthName}
        </div>
      </div>
    );
  };

  const getSessionsForDay = (date: Date): BaseSession[] => {
    const dateKey = date.toISOString().split('T')[0];
    return sessionsByDate.get(dateKey) || [];
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousWeek}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        
        <div className="text-sm font-medium">
          {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextWeek}
        >
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const daySessions = getSessionsForDay(day);
          const isToday = (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dayDate = new Date(day);
            dayDate.setHours(0, 0, 0, 0);
            return dayDate.getTime() === today.getTime();
          })();

          return (
            <div
              key={index}
              className={`border rounded-lg p-2 min-h-[120px] ${
                isToday ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              {/* Day Header */}
              {formatDayHeader(day)}
              
              {/* Sessions List */}
              <div className="space-y-1 mt-2">
                {daySessions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No sessions
                  </div>
                ) : (
                  daySessions.map((session) => {
                    const isSelected = selectedSessionIds.has(session.id);
                    const sessionDate = session.start_at ? new Date(session.start_at) : null;
                    
                    // Build subject display
                    const subject = session.subject;
                    const subjectParts = [];
                    if (subject?.curriculum) subjectParts.push(subject.curriculum);
                    if (subject?.year_level) subjectParts.push(`Y${subject.year_level}`);
                    if (subject?.name) subjectParts.push(subject.name);
                    if (subject?.level) subjectParts.push(subject.level);
                    const subjectDisplay = subjectParts.length > 0 
                      ? subjectParts.join(' ') 
                      : 'Unknown';

                    return (
                      <div
                        key={session.id}
                        className={`
                          p-2 rounded border text-xs cursor-pointer transition-all
                          ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50 hover:bg-primary/5'
                          }
                        `}
                        onClick={() => onToggleSession(session.id)}
                      >
                        <div className="font-medium mb-1 flex items-center gap-1">
                          <BookOpen className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{subjectDisplay}</span>
                        </div>
                        {sessionDate && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
                            <span>{formatTimeHHMM(session.start_at)}</span>
                            {session.end_at && (
                              <span>- {formatTimeHHMM(session.end_at)}</span>
                            )}
                          </div>
                        )}
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

