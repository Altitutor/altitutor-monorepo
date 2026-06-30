'use client';

import { useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

interface ClassSessionsTabProps {
  classData: Tables<'classes'>;
  classStudents: Tables<'students'>[];
  classStaff: Tables<'staff'>[];
}

export function ClassSessionsTab({ classData }: ClassSessionsTabProps) {
  const entityModals = useEntityModals();

  const handleOpenSession = useCallback((sessionId: string) => {
    entityModals.openSession(sessionId);
  }, [entityModals]);

  const handleOpenStudent = useCallback((studentId: string) => {
    entityModals.openStudent(studentId);
  }, [entityModals]);

  const handleOpenStaff = useCallback((staffId: string) => {
    entityModals.openStaff(staffId);
  }, [entityModals]);

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
