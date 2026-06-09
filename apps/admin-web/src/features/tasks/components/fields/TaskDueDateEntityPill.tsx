'use client';

import { isOverdue } from '@/shared/utils/datetime';
import { DatePickerPill } from '@/shared/components/DatePickerPill';
import type { TaskWithAssignee } from '../../types';

interface TaskDueDateEntityPillProps {
  task: TaskWithAssignee;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function TaskDueDateEntityPill({ task, onChange }: TaskDueDateEntityPillProps) {
  const dueDate = task.due_date;

  return (
    <DatePickerPill
      value={dueDate}
      onChange={onChange}
      valueFormat="iso"
      overdue={isOverdue(dueDate)}
    />
  );
}
