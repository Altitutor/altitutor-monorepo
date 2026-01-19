'use client';

import {
  FormControl,
  FormField,
  FormItem,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';

interface TaskDueDatePillProps {
  form: UseFormReturn<{ dueDate: string | null }>;
}

export function TaskDueDatePill({ form }: TaskDueDatePillProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

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
            })
          : null;

        return (
          <FormItem>
            <FormControl>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs border rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  dateInputRef.current?.click();
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{displayValue || 'Due date'}</span>
                </div>
              </Button>
            </FormControl>
            <input
              ref={(el) => {
                dateInputRef.current = el;
                // Call React Hook Form's ref if it exists
                if (field.ref) {
                  if (typeof field.ref === 'function') {
                    field.ref(el);
                  } else {
                    field.ref.current = el;
                  }
                }
              }}
              type="date"
              name={field.name}
              onBlur={field.onBlur}
              value={dateValue || ''}
              onChange={(e) => {
                field.onChange(e.target.value || null);
              }}
              className="sr-only"
              tabIndex={-1}
            />
          </FormItem>
        );
      }}
    />
  );
}
