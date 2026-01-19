'use client';

import { Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { TaskTitleField, TaskDescriptionField } from '../fields';
import { TaskActivityTab } from '@/features/activity/components/tabs/TaskActivityTab';
import { TaskNotes } from '../TaskNotes';
import type { TaskStatus } from '../../types';

interface TaskContentPanelProps {
  form: UseFormReturn<{
    title: string;
    description?: string;
    status: TaskStatus;
    priority: number;
    assignedTo: string | null;
    estimate: number | null;
    dueDate: string | null;
  }>;
  taskId: string | null;
  notes: unknown[];
  isOpen: boolean;
  showActivity?: boolean;
}

export function TaskContentPanel({
  form,
  taskId,
  notes,
  isOpen,
  showActivity = true,
}: TaskContentPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <TaskTitleField
          form={form as UseFormReturn<{ title: string }>}
          value={form.getValues('title')}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <TaskDescriptionField
          form={form as UseFormReturn<{ description?: string }>}
          value={form.getValues('description')}
        />
      </div>

      {/* Activity Section */}
      {showActivity && taskId && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Activity</h3>
            <TaskActivityTab taskId={taskId} isOpen={isOpen} />
          </div>
        </>
      )}

      {/* Notes Section */}
      {taskId && (
        <>
          <Separator />
          <TaskNotes
            taskId={taskId}
            notes={notes}
            onNoteAdded={() => {
              // Notes will auto-refresh via query invalidation
            }}
          />
        </>
      )}
    </div>
  );
}
