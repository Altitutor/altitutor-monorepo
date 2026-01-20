'use client';

import { UseFormReturn } from 'react-hook-form';
import { TaskStatusPill } from './TaskStatusPill';
import { TaskPriorityPill } from './TaskPriorityPill';
import { TaskAssigneePill } from './TaskAssigneePill';
import { TaskEstimatePill } from './TaskEstimatePill';
import { TaskDueDatePill } from './TaskDueDatePill';
import type { TaskStatus, TaskPriority } from '../../types';
import type { Tables } from '@altitutor/shared';

type TaskFormData = {
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: number;
  assignedTo: string | null;
  estimate: number | null;
  dueDate: string | null;
};

interface TaskPropertyPillsProps {
  form: UseFormReturn<TaskFormData>;
  selectedAssignee: Tables<'staff'> | null;
  onAssigneeChange: (staff: Tables<'staff'> | null) => void;
  taskStatus?: TaskStatus;
  enabled?: boolean;
}

export function TaskPropertyPills({
  form,
  selectedAssignee,
  onAssigneeChange,
  taskStatus,
  enabled = true,
}: TaskPropertyPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      <TaskStatusPill form={form as unknown as UseFormReturn<{ status: TaskStatus }>} taskStatus={taskStatus} />
      <TaskPriorityPill form={form as unknown as UseFormReturn<{ priority: TaskPriority }>} />
      <TaskAssigneePill
        form={form as unknown as UseFormReturn<{ assignedTo: string | null }>}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={onAssigneeChange}
        enabled={enabled}
      />
      <TaskEstimatePill form={form as unknown as UseFormReturn<{ estimate: number | null }>} />
      <TaskDueDatePill form={form as unknown as UseFormReturn<{ dueDate: string | null }>} />
    </div>
  );
}
