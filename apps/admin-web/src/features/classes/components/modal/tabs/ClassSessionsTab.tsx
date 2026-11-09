'use client';

import { useCallback, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';

interface ClassSessionsTabProps {
  classData: Tables<'classes'>;
}

export function ClassSessionsTab({ classData }: ClassSessionsTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const entityModals = useEntityNavigation();

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
    <SessionsTable
      classId={classData.id}
      renderMode={viewMode}
      toolbarView={{
        value: viewMode,
        options: [
          { value: 'table', label: 'Table' },
          { value: 'calendar', label: 'Calendar' },
        ],
        onChange: (next) => {
          if (next === 'table' || next === 'calendar') setViewMode(next);
        },
      }}
      onOpenSession={handleOpenSession}
      onOpenStudent={handleOpenStudent}
      onOpenStaff={handleOpenStaff}
      fillHeight
    />
  );
}
