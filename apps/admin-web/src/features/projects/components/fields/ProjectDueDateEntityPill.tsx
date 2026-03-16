'use client';

import { Input } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { isOverdue } from '@/shared/utils/datetime';

function toInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

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
  const dateValue = toInputValue(targetDate);

  return (
    <div
      className={cn(
        'relative flex items-center rounded-full border bg-background',
        collapsed ? 'h-8 w-[72px]' : 'h-8 min-w-[100px]',
        overdue && 'border-red-500'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar
        className={cn(
          'h-3 w-3 flex-shrink-0 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground',
          !targetDate && 'opacity-40'
        )}
      />
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className={cn(
          'h-8 border-0 bg-transparent pl-8 pr-2 text-xs rounded-full focus-visible:ring-0 focus-visible:ring-offset-0',
          collapsed ? 'w-full' : 'min-w-0',
          overdue && 'text-red-700 dark:text-red-400'
        )}
      />
    </div>
  );
}
