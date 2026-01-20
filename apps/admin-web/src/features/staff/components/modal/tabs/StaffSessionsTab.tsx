'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { StaffSessionsCalendarView } from './StaffSessionsCalendarView';

interface StaffSessionsTabProps {
  staff: Tables<'staff'>;
}

export function StaffSessionsTab({ staff }: StaffSessionsTabProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Date filter state - default: no dates
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // Prepare filters for API
  const rangeStart = dateRangeStart || undefined;
  const rangeEnd = dateRangeEnd || undefined;

  // Reset dates callback for clear button
  const handleResetDates = useCallback(() => {
    setDateRangeStart('');
    setDateRangeEnd('');
  }, []);

  const handleOpenSession = useCallback((sessionId: string) => {
    window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
  }, []);

  const handleOpenStudent = useCallback((studentId: string) => {
    window.dispatchEvent(new CustomEvent('open-student-modal', { detail: { id: studentId } }));
  }, []);

  const handleOpenStaff = useCallback((staffId: string) => {
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id: staffId } }));
  }, []);

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
          <StaffSessionsCalendarView
            staffId={staff.id}
            onOpenSession={handleOpenSession}
            classId={undefined}
          />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SessionsTable
            staffId={staff.id}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onOpenSession={handleOpenSession}
            onOpenStudent={handleOpenStudent}
            onOpenStaff={handleOpenStaff}
            onFromChange={setDateRangeStart}
            onToChange={setDateRangeEnd}
            onResetDates={handleResetDates}
            hideBilling={true}
            hideStudentFilter={true}
            hideTypeFilter={true}
            hideTutorLogFilter={true}
            hideSearch={true}
          />
        </div>
      )}
    </div>
  );
}
