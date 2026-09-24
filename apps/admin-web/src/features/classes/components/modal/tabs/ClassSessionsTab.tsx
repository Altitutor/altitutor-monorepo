'use client';

import { useCallback, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { SegmentedControl } from '@altitutor/ui';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { StudentSessionsCalendarView } from '@/features/students/components/StudentSessionsCalendarView';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

interface ClassSessionsTabProps {
  classData: Tables<'classes'>;
  classStudents: Tables<'students'>[];
  classStaff: Tables<'staff'>[];
}

export function ClassSessionsTab({ classData }: ClassSessionsTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
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
      <div className="flex items-center justify-between">
        <SegmentedControl
          value={viewMode}
          onValueChange={(value) => setViewMode(value as 'table' | 'calendar')}
          options={[
            { value: 'table', label: 'Table' },
            { value: 'calendar', label: 'Calendar' },
          ]}
        />
      </div>

      {viewMode === 'calendar' ? (
        <div className="flex-1 min-h-0">
          <StudentSessionsCalendarView classId={classData.id} onOpenSession={handleOpenSession} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SessionsTable
            classId={classData.id}
            onOpenSession={handleOpenSession}
            onOpenStudent={handleOpenStudent}
            onOpenStaff={handleOpenStaff}
            fillHeight={true}
          />
        </div>
      )}
    </div>
  );
}
