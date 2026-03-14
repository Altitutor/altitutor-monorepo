'use client';

import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatShortDate, isOverdue } from '@/shared/utils/datetime';
import { DatePickerPopover } from '@/shared/components/DatePickerPopover';

interface ProjectDueDateEntityPillProps {
  targetDate: string | null;
  collapsed?: boolean;
  onChange: (targetDate: string | null) => void;
}

export function ProjectDueDateEntityPill({
  targetDate,
  collapsed,
  onChange,
}: ProjectDueDateEntityPillProps) {
  const overdue = isOverdue(targetDate);
  const displayValue = formatShortDate(targetDate);

  return (
    <DatePickerPopover
      value={targetDate}
      onChange={onChange}
      modal={false}
      stopPropagation
    >
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
        <Calendar
          className={cn(
            'h-3 w-3 flex-shrink-0',
            !targetDate && 'text-muted-foreground opacity-40 group-hover:opacity-100'
          )}
        />
        {!collapsed && (
          <span
            className={cn(
              !targetDate && 'text-muted-foreground opacity-40 group-hover:opacity-100'
            )}
          >
            {displayValue || 'Due date'}
          </span>
        )}
      </Button>
    </DatePickerPopover>
  );
}
