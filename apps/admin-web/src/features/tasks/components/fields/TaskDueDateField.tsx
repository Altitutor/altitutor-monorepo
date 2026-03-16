'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
} from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import type { TaskFormData } from '../../types';

interface TaskDueDateFieldProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskDueDateField({ form }: TaskDueDateFieldProps) {
  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => {
        const dateValue = field.value
          ? typeof field.value === 'string'
            ? field.value.split('T')[0]
            : new Date(field.value).toISOString().split('T')[0]
          : '';

        return (
          <FormItem>
            <FormControl>
              <div className="relative">
                <Calendar className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  className="pl-9"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
