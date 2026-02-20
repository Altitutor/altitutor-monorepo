'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Tabs, TabsList, TabsTrigger, useToast } from '@altitutor/ui';
import { SessionsTable, UndoLogAbsenceConfirmDialog, RemoveFromSessionConfirmDialog } from '@/features/sessions/components';
import { StaffSessionsCalendarView } from './StaffSessionsCalendarView';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUndoStaffAbsences } from '@/features/sessions/hooks/useStaffAbsences';
import { useRemoveStaffFromSession } from '@/features/sessions/hooks/useSessionsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';

type StaffUndoTarget = {
  entityType: 'staff';
  staffId: string;
  staffName: string;
  sessionsStaffId: string;
  action: 'log' | 'swap';
  swappedStaffName?: string;
  sessionShortName: string;
};

type RemoveFromSessionTarget = {
  sessionId: string;
  entityType: 'staff';
  entityId: string;
  entityName: string;
  sessionTitle: string;
};

interface StaffSessionsTabProps {
  staff: Tables<'staff'>;
  onOpenSession?: (sessionId: string) => void;
}

export function StaffSessionsTab({ staff, onOpenSession }: StaffSessionsTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [undoTarget, setUndoTarget] = useState<StaffUndoTarget | null>(null);
  const [removeFromSessionTarget, setRemoveFromSessionTarget] = useState<RemoveFromSessionTarget | null>(null);
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const undoStaffAbsenceMutation = useUndoStaffAbsences();
  const removeStaffMutation = useRemoveStaffFromSession();
  const queryClient = useQueryClient();

  const handleOpenSession = useCallback((sessionId: string) => {
    if (onOpenSession) {
      onOpenSession(sessionId);
    } else {
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
    }
  }, [onOpenSession]);

  const handleOpenStudent = useCallback((studentId: string) => {
    window.dispatchEvent(new CustomEvent('open-student-modal', { detail: { id: studentId } }));
  }, []);

  const handleUndoLogAbsenceStaff = useCallback((payload: {
    staffId: string;
    staffName: string;
    sessionsStaffId: string;
    action: 'log' | 'swap';
    swappedStaffName?: string;
    sessionShortName: string;
  }) => {
    setUndoTarget({
      entityType: 'staff',
      staffId: payload.staffId,
      staffName: payload.staffName,
      sessionsStaffId: payload.sessionsStaffId,
      action: payload.action,
      swappedStaffName: payload.swappedStaffName,
      sessionShortName: payload.sessionShortName,
    });
  }, []);

  const handleRemoveStaffFromSession = useCallback((sessionId: string, staffId: string, staffName: string, sessionShortName?: string) => {
    setRemoveFromSessionTarget({
      sessionId,
      entityType: 'staff',
      entityId: staffId,
      entityName: staffName,
      sessionTitle: sessionShortName ?? 'session',
    });
  }, []);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'calendar')}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'calendar' && (
        <div className="flex-1 min-h-0">
          <StaffSessionsCalendarView
            staffId={staff.id}
            onOpenSession={handleOpenSession}
            classId={undefined}
          />
        </div>
      )}

      {viewMode === 'table' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SessionsTable
            staffId={staff.id}
            onOpenSession={handleOpenSession}
            onOpenStudent={handleOpenStudent}
            attendanceView="staff"
            onUndoLogAbsenceStaff={handleUndoLogAbsenceStaff}
            onRemoveStaffFromSession={handleRemoveStaffFromSession}
          />
        </div>
      )}

      {undoTarget && currentStaff && (
        <UndoLogAbsenceConfirmDialog
          isOpen={!!undoTarget}
          title="Undo logged absence?"
          description={`Mark ${undoTarget.staffName} as attending ${undoTarget.sessionShortName}?`}
          secondaryDescription={
            undoTarget.action === 'swap' && undoTarget.swappedStaffName
              ? `This will remove replacement staff ${undoTarget.swappedStaffName} from this session.`
              : undefined
          }
          confirmLabel="Undo Log Absence"
          isPending={undoStaffAbsenceMutation.isPending}
          onCancel={() => setUndoTarget(null)}
          onConfirm={async () => {
            try {
              const result = await undoStaffAbsenceMutation.mutateAsync({
                staffId: currentStaff.id,
                operations: [
                  {
                    staff_id: undoTarget.staffId,
                    original_sessions_staff_id: undoTarget.sessionsStaffId,
                    action: undoTarget.action,
                  },
                ],
              });
              if (!result.success) {
                toast({
                  title: 'Error',
                  description: result.error || 'Failed to undo staff absence',
                  variant: 'destructive',
                });
                return;
              }
              await queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
              setUndoTarget(null);
              toast({
                title: 'Absence undone',
                description: 'Attendance has been restored for this session.',
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to undo staff absence';
              toast({
                title: 'Error',
                description: message,
                variant: 'destructive',
              });
            }
          }}
        />
      )}

      {removeFromSessionTarget && (
        <RemoveFromSessionConfirmDialog
          isOpen={!!removeFromSessionTarget}
          entityType={removeFromSessionTarget.entityType}
          entityName={removeFromSessionTarget.entityName}
          sessionTitle={removeFromSessionTarget.sessionTitle}
          isPending={removeStaffMutation.isPending}
          onCancel={() => setRemoveFromSessionTarget(null)}
          onConfirm={async () => {
            if (!removeFromSessionTarget) return;
            const target = removeFromSessionTarget;
            try {
              await removeStaffMutation.mutateAsync({
                sessionId: target.sessionId,
                staffId: target.entityId,
              });
              setRemoveFromSessionTarget(null);
              toast({
                title: 'Staff removed',
                description: `${target.entityName} removed from session.`,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to remove staff';
              toast({
                title: 'Error',
                description: message,
                variant: 'destructive',
              });
            }
          }}
        />
      )}
    </div>
  );
}
