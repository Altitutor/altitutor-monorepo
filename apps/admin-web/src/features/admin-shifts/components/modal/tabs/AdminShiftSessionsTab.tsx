'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';

interface AdminShiftSessionsTabProps {
  adminShiftData: Tables<'admin_shifts'>;
  adminShiftStaff: Tables<'staff'>[];
  adminShiftSessions: Tables<'sessions'>[];
}

export function AdminShiftSessionsTab({ adminShiftData }: AdminShiftSessionsTabProps) {
  // Date filter state - default: no dates
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // Prepare filters for API - handle empty strings as undefined
  const rangeStart = dateRangeStart && dateRangeStart.trim() !== '' ? dateRangeStart : undefined;
  const rangeEnd = dateRangeEnd && dateRangeEnd.trim() !== '' ? dateRangeEnd : undefined;

  // Reset dates callback for clear button - resets to empty dates
  const handleResetDates = useCallback(() => {
    setDateRangeStart('');
    setDateRangeEnd('');
  }, []);

  const handleOpenSession = useCallback((sessionId: string) => {
    window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
  }, []);

  const handleOpenStaff = useCallback((staffId: string) => {
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id: staffId } }));
  }, []);

  return (
    <div className="h-full flex flex-col space-y-4 min-h-0">
      {/* Sessions Table - Filter by admin_shift_id */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SessionsTable
          adminShiftId={adminShiftData.id}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onOpenSession={handleOpenSession}
          onOpenStaff={handleOpenStaff}
          onFromChange={setDateRangeStart}
          onToChange={setDateRangeEnd}
          onResetDates={handleResetDates}
          hideTypeColumn={true}
          hideClassColumn={true}
          hideStudentsColumn={true}
          hideStudentFilter={true}
          hideTypeFilter={true}
          hideTutorLogFilter={true}
          hideSearch={true}
        />
      </div>
    </div>
  );
}
