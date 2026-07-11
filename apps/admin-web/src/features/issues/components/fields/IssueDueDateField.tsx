'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SmartDatePickerField,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import type { IssueFormData } from '../../types';

interface IssueDueDateFieldProps {
  form: UseFormReturn<IssueFormData>;
}

export function IssueDueDateField({ form }: IssueDueDateFieldProps) {
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
