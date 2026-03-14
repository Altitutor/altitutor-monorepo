'use client';

import { FormControl, FormField, FormItem, Button } from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import type { TaskFormData } from '../../types';
import { DatePickerPopover } from '@/shared/components/DatePickerPopover';

interface TaskDueDatePillProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskDueDatePill({ form }: TaskDueDatePillProps) {
  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => {
        const dueDateValue = field.value;
        const valueForPicker =
          dueDateValue && typeof dueDateValue === 'string'
            ? dueDateValue
            : dueDateValue
              ? new Date(dueDateValue).toISOString()
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
              <DatePickerPopover
                value={valueForPicker}
                onChange={(v) => field.onChange(v ? v.split('T')[0] : null)}
                onBlur={field.onBlur}
                name={field.name}
                modal={false}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs border rounded-full"
                >
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{displayValue || 'Due date'}</span>
                  </div>
                </Button>
              </DatePickerPopover>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
