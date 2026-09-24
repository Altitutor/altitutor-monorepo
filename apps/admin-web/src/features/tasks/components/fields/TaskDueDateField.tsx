'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SmartDatePickerField,
} from '@altitutor/ui';
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
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <SmartDatePickerField
              value={field.value ?? null}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
