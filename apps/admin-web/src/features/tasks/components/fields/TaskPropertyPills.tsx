'use client';

import { UseFormReturn } from 'react-hook-form';
import { TaskStatusPill } from './TaskStatusPill';
import { TaskPriorityPill } from './TaskPriorityPill';
import { TaskAssigneePill } from './TaskAssigneePill';
import { TaskEstimatePill } from './TaskEstimatePill';
import { TaskDueDatePill } from './TaskDueDatePill';
import type { TaskFormData, TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';

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
      <TaskStatusPill form={form} taskStatus={taskStatus} />
      <TaskPriorityPill form={form} />
      <TaskAssigneePill
        form={form}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={onAssigneeChange}
        enabled={enabled}
      />
      <TaskEstimatePill form={form} />
      <TaskDueDatePill form={form} />
    </div>
  );
}
