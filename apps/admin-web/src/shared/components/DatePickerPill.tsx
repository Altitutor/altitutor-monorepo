'use client';

import type { ReactNode } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatPillDisplayDate } from '@/shared/utils/datetime';
import { DatePickerPopover } from './DatePickerPopover';

export type DatePickerPillValueFormat = 'date' | 'iso';

export interface DatePickerPillProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  /** `date` returns YYYY-MM-DD; `iso` returns ISO midnight UTC */
  valueFormat?: DatePickerPillValueFormat;
  icon?: ReactNode;
  overdue?: boolean;
  /** Fade pill when no date is set (default true) */
  emptyOpacity?: boolean;
  className?: string;
  modal?: boolean;
  stopPropagation?: boolean;
}

export function DatePickerPill({
  value,
  onChange,
  onBlur,
  valueFormat = 'date',
  icon,
  overdue = false,
  emptyOpacity = true,
  className,
  modal = false,
  stopPropagation = true,
}: DatePickerPillProps) {
  const formattedDate = formatPillDisplayDate(value);

  const handleChange = (isoValue: string | null) => {
    if (!isoValue) {
      onChange(null);
      return;
    }
    onChange(valueFormat === 'iso' ? isoValue : isoValue.split('T')[0]);
  };

  return (
    <DatePickerPopover
      value={value ?? null}
      onChange={handleChange}
      onBlur={onBlur}
      modal={modal}
      stopPropagation={stopPropagation}
    >
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'relative inline-flex items-center gap-1 h-7 rounded-full border bg-background cursor-pointer select-none',
          formattedDate ? 'px-2' : 'w-7 justify-center',
          overdue && 'border-red-500',
          !value && emptyOpacity && 'opacity-50',
          className
        )}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
          }
        }}
      >
        {icon ?? (
          <Calendar
            className={cn(
              'h-3 w-3 flex-shrink-0 pointer-events-none',
              overdue ? 'text-red-500' : 'text-muted-foreground'
            )}
          />
        )}
        {formattedDate && (
          <span
            className={cn(
              'text-xs whitespace-nowrap pointer-events-none',
              overdue && 'text-red-700 dark:text-red-400'
            )}
          >
            {formattedDate}
          </span>
        )}
      </div>
    </DatePickerPopover>
  );
}
