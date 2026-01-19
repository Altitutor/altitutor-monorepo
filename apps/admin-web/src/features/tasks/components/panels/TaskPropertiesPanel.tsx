'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  TaskStatusField,
  TaskPriorityField,
  TaskAssigneeField,
  TaskEstimateField,
  TaskDueDateField,
} from '../fields';
import type { TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';

interface TaskPropertiesPanelProps {
  form: UseFormReturn<{
    title: string;
    description?: string;
    status: TaskStatus;
    priority: number;
    assignedTo: string | null;
    estimate: number | null;
    dueDate: string | null;
  }>;
  selectedAssignee: Tables<'staff'> | null;
  onAssigneeChange: (staff: Tables<'staff'> | null) => void;
  taskStatus?: TaskStatus;
  enabled?: boolean;
}

export function TaskPropertiesPanel({
  form,
  selectedAssignee,
  onAssigneeChange,
  taskStatus,
  enabled = true,
}: TaskPropertiesPanelProps) {
  return (
    <div className="w-80 border-r flex-shrink-0 overflow-y-auto p-6 space-y-6">
      <TaskStatusField form={form as UseFormReturn<{ status: TaskStatus }>} taskStatus={taskStatus} />
      <TaskPriorityField form={form as UseFormReturn<{ priority: number }>} />
      <TaskAssigneeField
        form={form as UseFormReturn<{ assignedTo: string | null }>}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={onAssigneeChange}
        enabled={enabled}
      />
      <TaskEstimateField form={form as UseFormReturn<{ estimate: number | null }>} />
      <TaskDueDateField form={form as UseFormReturn<{ dueDate: string | null }>} />
    </div>
  );
}
