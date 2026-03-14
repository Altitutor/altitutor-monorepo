'use client';

import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatIssueDueDate, isIssueOverdue } from '../utils/issueUtils';
import { DatePickerPopover } from '@/shared/components/DatePickerPopover';

interface IssueDueDateEntityPillProps {
  dueDate: string | null;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function IssueDueDateEntityPill({ dueDate, collapsed, onChange }: IssueDueDateEntityPillProps) {
  const overdue = isIssueOverdue(dueDate);
  const displayValue = formatIssueDueDate(dueDate);

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
        {!collapsed && (
          <span className={cn(!dueDate && 'text-muted-foreground opacity-40 group-hover:opacity-100')}>
            {displayValue || 'Due date'}
          </span>
        )}
      </Button>
    </DatePickerPopover>
  );
}
