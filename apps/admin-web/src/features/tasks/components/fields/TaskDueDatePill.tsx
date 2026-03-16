'use client';

import {
  FormControl,
  FormField,
  FormItem,
  Input,
} from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import type { TaskFormData } from '../../types';

function toInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
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

        return (
          <FormItem>
            <FormControl>
              <div className="relative flex items-center h-8 min-w-[100px] rounded-full border bg-background">
                <Calendar className="h-3 w-3 flex-shrink-0 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  className="h-8 border-0 bg-transparent pl-8 pr-2 text-xs rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
