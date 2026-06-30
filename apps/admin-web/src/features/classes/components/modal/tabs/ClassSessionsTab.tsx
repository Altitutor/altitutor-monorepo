'use client';

import { useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';

interface ClassSessionsTabProps {
  classData: Tables<'classes'>;
  classStudents: Tables<'students'>[];
  classStaff: Tables<'staff'>[];
}

export function ClassSessionsTab({ classData }: ClassSessionsTabProps) {
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
    <div className="h-full min-h-0 flex flex-col space-y-4">
      {/* Sessions Table */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SessionsTable
          classId={classData.id}
          onOpenSession={handleOpenSession}
          onOpenStudent={handleOpenStudent}
          onOpenStaff={handleOpenStaff}
          fillHeight={true}
        />
      </div>
    </div>
  );
}
