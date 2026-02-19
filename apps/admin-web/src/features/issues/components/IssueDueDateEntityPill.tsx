'use client';

import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { useRef, type MutableRefObject } from 'react';
import { cn } from '@/shared/utils';
import { formatIssueDueDate, isIssueOverdue } from '../utils/issueUtils';

interface IssueDueDateEntityPillProps {
  dueDate: string | null;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function IssueDueDateEntityPill({ dueDate, collapsed, onChange }: IssueDueDateEntityPillProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null) as MutableRefObject<HTMLInputElement | null>;
  const overdue = isIssueOverdue(dueDate);
  const displayValue = formatIssueDueDate(dueDate);

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
        onChange={(e) => onChange(e.target.value || null)}
        className="sr-only"
        tabIndex={-1}
      />
    </>
  );
}
