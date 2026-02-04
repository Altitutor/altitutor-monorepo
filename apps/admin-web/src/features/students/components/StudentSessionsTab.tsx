'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { StudentSessionsCalendarView } from './StudentSessionsCalendarView';
import { StudentModalSessionsTable } from './StudentModalSessionsTable';

interface StudentSessionsTabProps {
  student: Tables<'students'>;
  onOpenSession?: (sessionId: string) => void;
}

export function StudentSessionsTab({ student, onOpenSession }: StudentSessionsTabProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Date filter state - default: no dates
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // Prepare date range for API (YYYY-MM-DD format)
  const rangeStart = dateRangeStart || undefined;
  const rangeEnd = dateRangeEnd || undefined;

  // Reset dates callback for clear button
  const handleResetDates = useCallback(() => {
    setDateRangeStart('');
    setDateRangeEnd('');
  }, []);

  const handleOpenSession = useCallback((sessionId: string) => {
    if (onOpenSession) {
      onOpenSession(sessionId);
    } else {
      // Default behavior: dispatch event to open session modal
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
    }
  }, [onOpenSession]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* View Selector */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'calendar')}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="flex-1 min-h-0">
          <StudentSessionsCalendarView
            studentId={student.id}
            onOpenSession={handleOpenSession}
            classId={undefined}
          />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <StudentModalSessionsTable
            studentId={student.id}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onOpenSession={handleOpenSession}
            onFromChange={setDateRangeStart}
            onToChange={setDateRangeEnd}
            onResetDates={handleResetDates}
          />
        </div>
      )}
    </div>
  );
}
