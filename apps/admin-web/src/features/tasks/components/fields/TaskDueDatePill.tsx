'use client';

import { FormControl, FormField, FormItem } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { DatePickerPill } from '@/shared/components/DatePickerPill';
import type { TaskFormData } from '../../types';

interface TaskDueDatePillProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskDueDatePill({ form }: TaskDueDatePillProps) {
  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <DatePickerPill
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
