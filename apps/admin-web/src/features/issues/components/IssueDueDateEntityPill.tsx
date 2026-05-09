'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { isIssueOverdue } from '../utils/issueUtils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function toInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

interface IssueDueDateEntityPillProps {
  dueDate: string | null;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function IssueDueDateEntityPill({ dueDate, onChange }: IssueDueDateEntityPillProps) {
  const overdue = isIssueOverdue(dueDate);
  const dateValue = toInputValue(dueDate);
  const formattedDate = formatDisplayDate(dueDate);

  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-1 h-7 rounded-full border bg-background cursor-pointer select-none',
        formattedDate ? 'px-2' : 'w-7 justify-center',
        overdue ? 'border-red-500' : '',
        !dueDate && 'opacity-50'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar
        className={cn(
          'h-3 w-3 flex-shrink-0 pointer-events-none',
          overdue ? 'text-red-500' : 'text-muted-foreground'
        )}
      />
      {formattedDate && (
        <span
          className={cn(
            'text-xs whitespace-nowrap pointer-events-none',
            overdue ? 'text-red-700 dark:text-red-400' : ''
          )}
        >
          {formattedDate}
        </span>
      )}
      <input
        type="date"
        value={dateValue}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      />
    </div>
  );
}
