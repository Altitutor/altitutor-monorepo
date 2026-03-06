'use client';

import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { useRef, type MutableRefObject } from 'react';
import { cn } from '@/shared/utils';
import { formatShortDate, isOverdue } from '@/shared/utils/datetime';
import type { TaskWithAssignee } from '../../types';

interface TaskDueDateEntityPillProps {
  task: TaskWithAssignee;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function TaskDueDateEntityPill({ task, collapsed, onChange }: TaskDueDateEntityPillProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null) as MutableRefObject<HTMLInputElement | null>;
  const dueDate = task.due_date;
  const overdue = isOverdue(dueDate);
  const displayValue = formatShortDate(dueDate);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'h-8 border rounded-full bg-background group gap-1.5',
          collapsed ? 'px-2 w-auto' : 'px-3 text-xs w-auto',
          overdue && 'border-red-500 text-red-700 dark:text-red-400'
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dateInputRef.current?.click();
        }}
      >
        <Calendar className={cn('h-3 w-3 flex-shrink-0', !dueDate && 'text-muted-foreground opacity-40 group-hover:opacity-100')} />
        {!collapsed && (
          <span className={cn(!dueDate && 'text-muted-foreground opacity-40 group-hover:opacity-100')}>
            {displayValue || 'Due date'}
          </span>
        )}
      </Button>
      <input
        ref={dateInputRef}
        type="date"
        value={dueDate ? new Date(dueDate).toISOString().split('T')[0] : ''}
        onChange={(e) => {
          const val = e.target.value || null;
          onChange(val ? new Date(val).toISOString() : null);
        }}
        className="sr-only"
        tabIndex={-1}
      />
    </>
  );
}
