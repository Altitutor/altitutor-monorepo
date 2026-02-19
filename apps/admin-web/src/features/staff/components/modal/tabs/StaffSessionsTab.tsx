'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { StaffSessionsCalendarView } from './StaffSessionsCalendarView';

interface StaffSessionsTabProps {
  staff: Tables<'staff'>;
  onOpenSession?: (sessionId: string) => void;
}

export function StaffSessionsTab({ staff, onOpenSession }: StaffSessionsTabProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  const handleOpenSession = useCallback((sessionId: string) => {
    if (onOpenSession) {
      onOpenSession(sessionId);
    } else {
      // Default behavior: dispatch event to open session modal
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
    }
  }, [onOpenSession]);

  const handleOpenStudent = useCallback((studentId: string) => {
    window.dispatchEvent(new CustomEvent('open-student-modal', { detail: { id: studentId } }));
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
            onOpenSession={handleOpenSession}
            onOpenStudent={handleOpenStudent}
          />
        </div>
      )}
    </div>
  );
}
