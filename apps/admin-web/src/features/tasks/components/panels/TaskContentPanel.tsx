'use client';

import { Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { TaskTitleField, TaskDescriptionField } from '../fields';
import { TaskPropertyPills } from '../fields/TaskPropertyPills';
import { TaskActivityTab } from '@/features/activity/components/tabs/TaskActivityTab';
import { TaskNotes } from '../TaskNotes';
import type { TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

type TaskFormData = {
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: number;
  assignedTo: string | null;
  estimate: number | null;
  dueDate: string | null;
};

interface TaskContentPanelProps {
  form: UseFormReturn<TaskFormData>;
  taskId: string | null;
  notes: NoteWithStaff[];
  isOpen: boolean;
  showActivity?: boolean;
  selectedAssignee?: Tables<'staff'> | null;
  onAssigneeChange?: (staff: Tables<'staff'> | null) => void;
  taskStatus?: TaskStatus;
  enabled?: boolean;
}

export function TaskContentPanel({
  form,
  taskId,
  notes,
  isOpen,
  showActivity = true,
  selectedAssignee,
  onAssigneeChange,
  taskStatus,
  enabled = true,
}: TaskContentPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Property Pills - Mobile Only */}
      {selectedAssignee !== undefined && onAssigneeChange && (
        <div className="md:hidden -mt-2">
          <TaskPropertyPills
            form={form}
            selectedAssignee={selectedAssignee || null}
            onAssigneeChange={onAssigneeChange}
            taskStatus={taskStatus}
            enabled={enabled}
          />
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <TaskTitleField
          form={form as unknown as UseFormReturn<{ title: string }>}
          value={form.getValues('title')}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <TaskDescriptionField
          form={form as unknown as UseFormReturn<{ description?: string }>}
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
