'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';

interface ClassSessionsTabProps {
  classData: Tables<'classes'>;
  classStudents: Tables<'students'>[];
  classStaff: Tables<'staff'>[];
}

export function ClassSessionsTab({ classData }: ClassSessionsTabProps) {
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
      {/* Sessions Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SessionsTable
          classId={classData.id}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onOpenSession={handleOpenSession}
          onOpenStudent={handleOpenStudent}
          onOpenStaff={handleOpenStaff}
          onFromChange={setDateRangeStart}
          onToChange={setDateRangeEnd}
          onResetDates={handleResetDates}
          hideTypeColumn={true}
          hideStudentFilter={true}
          hideTypeFilter={true}
          hideTutorLogFilter={true}
          hideSearch={true}
        />
      </div>
    </div>
  );
}
