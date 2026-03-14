'use client';

import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatShortDate, isOverdue } from '@/shared/utils/datetime';
import type { TaskWithAssignee } from '../../types';
import { DatePickerPopover } from '@/shared/components/DatePickerPopover';

/** Compact d/m format for collapsed pill (e.g. 14/3, 2/4, 11/6) */
function formatDueDateCompact(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

interface TaskDueDateEntityPillProps {
  task: TaskWithAssignee;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function TaskDueDateEntityPill({ task, collapsed, onChange }: TaskDueDateEntityPillProps) {
  const dueDate = task.due_date;
  const overdue = isOverdue(dueDate);
  const displayValue = formatShortDate(dueDate);
  const compactValue = formatDueDateCompact(dueDate);

  return (
    <DatePickerPopover value={dueDate} onChange={onChange} modal={false} stopPropagation>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'h-8 border rounded-full bg-background group gap-1.5',
          collapsed ? 'px-2 w-auto' : 'px-3 text-xs w-auto',
          overdue && 'border-red-500 text-red-700 dark:text-red-400'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar className={cn('h-3 w-3 flex-shrink-0', !dueDate && 'text-muted-foreground opacity-40 group-hover:opacity-100')} />
        {collapsed ? (
          compactValue ? (
            <span className={cn(overdue && 'text-red-700 dark:text-red-400')}>{compactValue}</span>
          ) : null
        ) : (
          <span className={cn(!dueDate && 'text-muted-foreground opacity-40 group-hover:opacity-100')}>
            {displayValue || 'Due date'}
          </span>
        )}
      </Button>
    </DatePickerPopover>
  );
}
