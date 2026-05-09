'use client';

import { FormControl, FormField, FormItem } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { TaskFormData } from '../../types';

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

interface TaskDueDatePillProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskDueDatePill({ form }: TaskDueDatePillProps) {
  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => {
        const dateValue = toInputValue(field.value);
        const formattedDate = formatDisplayDate(field.value);

        return (
          <FormItem>
            <FormControl>
              <div
                className={cn(
                  'relative inline-flex items-center gap-1 h-7 rounded-full border bg-background cursor-pointer select-none',
                  formattedDate ? 'px-2' : 'w-7 justify-center'
                )}
              >
                <Calendar className="h-3 w-3 flex-shrink-0 pointer-events-none text-muted-foreground" />
                {formattedDate && (
                  <span className="text-xs whitespace-nowrap pointer-events-none">
                    {formattedDate}
                  </span>
                )}
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </div>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
