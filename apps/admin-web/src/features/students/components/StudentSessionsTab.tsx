'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SegmentedControl, useToast } from '@altitutor/ui';
import { StudentSessionsCalendarView } from './StudentSessionsCalendarView';
import { SessionsTable, UndoLogAbsenceConfirmDialog, RemoveFromSessionConfirmDialog } from '@/features/sessions/components';
import { useCurrentStaff } from '@/shared/hooks';
import { useUndoAbsences } from '@/features/sessions/hooks/useAbsences';
import { useRemoveStudentFromSession } from '@/features/sessions/hooks/useSessionsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';

type StudentUndoTarget = {
  entityType: 'student';
  studentId: string;
  studentName: string;
  sessionsStudentsId: string;
  action: 'credit' | 'reschedule';
  rescheduledSessionTitle?: string;
  sessionShortName: string;
};

type RemoveFromSessionTarget = {
  sessionId: string;
  entityType: 'student';
  entityId: string;
  entityName: string;
  sessionTitle: string;
};

interface StudentSessionsTabProps {
  student: Tables<'students'>;
  onOpenSession?: (sessionId: string) => void;
}

export function StudentSessionsTab({ student, onOpenSession }: StudentSessionsTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [undoTarget, setUndoTarget] = useState<StudentUndoTarget | null>(null);
  const [removeFromSessionTarget, setRemoveFromSessionTarget] = useState<RemoveFromSessionTarget | null>(null);
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const undoAbsenceMutation = useUndoAbsences();
  const removeStudentMutation = useRemoveStudentFromSession();
  const queryClient = useQueryClient();

  const handleOpenSession = useCallback((sessionId: string) => {
    if (onOpenSession) {
      onOpenSession(sessionId);
    } else {
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
    }
  }, [onOpenSession]);

  const handleOpenStaff = useCallback((staffId: string) => {
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id: staffId } }));
  }, []);

  const handleUndoLogAbsenceStudent = useCallback((payload: {
    studentId: string;
    studentName: string;
    sessionsStudentsId: string;
    action: 'credit' | 'reschedule';
    rescheduledSessionTitle?: string;
    sessionShortName: string;
  }) => {
    setUndoTarget({
      entityType: 'student',
      studentId: payload.studentId,
      studentName: payload.studentName,
      sessionsStudentsId: payload.sessionsStudentsId,
      action: payload.action,
      rescheduledSessionTitle: payload.rescheduledSessionTitle,
      sessionShortName: payload.sessionShortName,
    });
  }, []);

  const handleRemoveStudentFromSession = useCallback((sessionId: string, studentId: string, studentName: string, sessionShortName?: string) => {
    setRemoveFromSessionTarget({
      sessionId,
      entityType: 'student',
      entityId: studentId,
      entityName: studentName,
      sessionTitle: sessionShortName ?? 'session',
    });
  }, []);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <SegmentedControl
          value={viewMode}
          onValueChange={(v) => setViewMode(v as 'table' | 'calendar')}
          options={[
            { value: 'table', label: 'Table' },
            { value: 'calendar', label: 'Calendar' },
          ]}
        />
      </div>

      {viewMode === 'calendar' && (
        <div className="flex-1 min-h-0">
          <StudentSessionsCalendarView
            studentId={student.id}
            onOpenSession={handleOpenSession}
            classId={undefined}
          />
        </div>
      )}

      {viewMode === 'table' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SessionsTable
            studentId={student.id}
            onOpenSession={handleOpenSession}
            onOpenStaff={handleOpenStaff}
            hideStudentFilter={true}
            attendanceView="student"
            onUndoLogAbsenceStudent={handleUndoLogAbsenceStudent}
            onRemoveStudentFromSession={handleRemoveStudentFromSession}
          />
        </div>
      )}

      {undoTarget && currentStaff && (
        <UndoLogAbsenceConfirmDialog
          isOpen={!!undoTarget}
          title="Undo logged absence?"
          description={`Mark ${undoTarget.studentName} as attending ${undoTarget.sessionShortName}?`}
          secondaryDescription={
            undoTarget.action === 'reschedule' && undoTarget.rescheduledSessionTitle
              ? `This will remove them from the rescheduled session ${undoTarget.rescheduledSessionTitle}.`
              : undefined
          }
          confirmLabel="Undo Log Absence"
          isPending={undoAbsenceMutation.isPending}
          onCancel={() => setUndoTarget(null)}
          onConfirm={async () => {
            try {
              const result = await undoAbsenceMutation.mutateAsync({
                staffId: currentStaff.id,
                operations: [
                  {
                    student_id: undoTarget.studentId,
                    original_sessions_students_id: undoTarget.sessionsStudentsId,
                    action: undoTarget.action,
                  },
                ],
              });
              if (!result.success) {
                toast({
                  title: 'Error',
                  description: result.error || 'Failed to undo absence',
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
              const message = error instanceof Error ? error.message : 'Failed to undo absence';
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
          isPending={removeStudentMutation.isPending}
          onCancel={() => setRemoveFromSessionTarget(null)}
          onConfirm={async () => {
            if (!removeFromSessionTarget) return;
            const target = removeFromSessionTarget;
            try {
              await removeStudentMutation.mutateAsync({
                sessionId: target.sessionId,
                studentId: target.entityId,
              });
              setRemoveFromSessionTarget(null);
              toast({
                title: 'Student removed',
                description: `${target.entityName} removed from session.`,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to remove student';
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
