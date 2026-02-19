'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  TaskStatusField,
  TaskPriorityField,
  TaskAssigneeField,
  TaskIssueField,
  TaskEstimateField,
  TaskDueDateField,
} from '../fields';
import type { TaskStatus, TaskPriority } from '../../types';
import type { Tables } from '@altitutor/shared';

type TaskFormData = {
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: number;
  assignedTo: string | null;
  issueId: string | null;
  estimate: number | null;
  dueDate: string | null;
};

interface TaskPropertiesPanelProps {
  form: UseFormReturn<TaskFormData>;
  selectedAssignee: Tables<'staff'> | null;
  onAssigneeChange: (staff: Tables<'staff'> | null) => void;
  selectedIssue: { id: string; name: string | null } | null;
  onIssueChange: (issue: { id: string; name: string | null } | null) => void;
  taskStatus?: TaskStatus;
  enabled?: boolean;
}

export function TaskPropertiesPanel({
  form,
  selectedAssignee,
  onAssigneeChange,
  selectedIssue,
  onIssueChange,
  taskStatus,
  enabled = true,
}: TaskPropertiesPanelProps) {
  return (
    <div className="hidden md:block w-80 border-l flex-shrink-0 overflow-y-auto p-6 space-y-6">
      <TaskStatusField form={form as unknown as UseFormReturn<{ status: TaskStatus }>} taskStatus={taskStatus} />
      <TaskPriorityField form={form as unknown as UseFormReturn<{ priority: TaskPriority }>} />
      <TaskAssigneeField
        form={form as unknown as UseFormReturn<{ assignedTo: string | null }>}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={onAssigneeChange}
        enabled={enabled}
      />
      <TaskIssueField
        form={form as unknown as UseFormReturn<{ issueId: string | null }>}
        selectedIssue={selectedIssue}
        onIssueChange={onIssueChange}
      />
      <TaskEstimateField form={form as unknown as UseFormReturn<{ estimate: number | null }>} />
      <TaskDueDateField form={form as unknown as UseFormReturn<{ dueDate: string | null }>} />
    </div>
  );
}
