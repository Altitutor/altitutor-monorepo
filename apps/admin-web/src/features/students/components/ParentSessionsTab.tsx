'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SegmentedControl, useToast } from '@altitutor/ui';
import { StudentSessionsCalendarView } from './StudentSessionsCalendarView';
import { SessionsTable, RemoveFromSessionConfirmDialog } from '@/features/sessions/components';
import { useRemoveParentFromSession } from '@/features/sessions/hooks/useSessionsQuery';
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';

type RemoveFromSessionTarget = {
  sessionId: string;
  entityName: string;
  sessionTitle: string;
};

interface ParentSessionsTabProps {
  parent: Tables<'parents'>;
  onOpenSession?: (sessionId: string) => void;
}

export function ParentSessionsTab({ parent, onOpenSession }: ParentSessionsTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [removeFromSessionTarget, setRemoveFromSessionTarget] = useState<RemoveFromSessionTarget | null>(null);
  const { toast } = useToast();
  const removeParentMutation = useRemoveParentFromSession();
  const entityModals = useEntityNavigation();
  const parentName = `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() || 'Parent';

  const handleOpenSession = useCallback((sessionId: string) => {
    if (onOpenSession) {
      onOpenSession(sessionId);
    } else {
      entityModals.openSession(sessionId);
    }
  }, [entityModals, onOpenSession]);

  const handleOpenStaff = useCallback((staffId: string) => {
    entityModals.openStaff(staffId);
  }, [entityModals]);

  const handleOpenStudent = useCallback((studentId: string) => {
    entityModals.openStudent(studentId);
  }, [entityModals]);

  const handleRemoveParentFromSession = useCallback((sessionId: string, sessionShortName?: string) => {
    setRemoveFromSessionTarget({
      sessionId,
      entityName: parentName,
      sessionTitle: sessionShortName ?? 'session',
    });
  }, [parentName]);

  return (
    <div className="h-full min-h-0 flex flex-col space-y-4">
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
            parentId={parent.id}
            onOpenSession={handleOpenSession}
          />
        </div>
      )}

      {viewMode === 'table' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SessionsTable
            parentId={parent.id}
            onOpenSession={handleOpenSession}
            onOpenStaff={handleOpenStaff}
            onOpenStudent={handleOpenStudent}
            skipUrlSync={true}
            fillHeight={true}
            onRemoveParentFromSession={handleRemoveParentFromSession}
          />
        </div>
      )}

      {removeFromSessionTarget && (
        <RemoveFromSessionConfirmDialog
          isOpen={!!removeFromSessionTarget}
          entityType="parent"
          entityName={removeFromSessionTarget.entityName}
          sessionTitle={removeFromSessionTarget.sessionTitle}
          isPending={removeParentMutation.isPending}
          onCancel={() => setRemoveFromSessionTarget(null)}
          onConfirm={async () => {
            if (!removeFromSessionTarget) return;
            const target = removeFromSessionTarget;
            try {
              await removeParentMutation.mutateAsync({
                sessionId: target.sessionId,
                parentId: parent.id,
              });
              setRemoveFromSessionTarget(null);
              toast({
                title: 'Parent removed',
                description: `${target.entityName} removed from session.`,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to remove parent';
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
