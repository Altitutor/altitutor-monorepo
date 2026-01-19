'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';

interface TaskDueDateFieldProps {
  form: UseFormReturn<{ dueDate: string | null }>;
}

export function TaskDueDateField({ form }: TaskDueDateFieldProps) {
  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => {
        const dueDateValue = field.value;
        const dateValue = dueDateValue
          ? typeof dueDateValue === 'string'
            ? dueDateValue
            : new Date(dueDateValue).toISOString().split('T')[0]
          : null;
        const displayValue = dueDateValue
          ? new Date(dueDateValue).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null;

        return (
          <FormItem>
            <FormControl>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={(e) => {
                  e.preventDefault();
                  const input = document.createElement('input');
                  input.type = 'date';
                  input.value = dateValue || '';
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    field.onChange(target.value || null);
                  };
                  input.click();
                }}
              >
                <div className="flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(!dueDateValue && 'text-muted-foreground')}>
                    {displayValue || 'Set due date'}
                  </span>
                </div>
              </Button>
            </FormControl>
            <input
              type="date"
              {...field}
              value={dateValue || ''}
              onChange={(e) => {
                field.onChange(e.target.value || null);
              }}
              className="sr-only"
              tabIndex={-1}
            />
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
