'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SmartDatePickerField,
} from '@altitutor/ui';
import { DatePickerPill } from '@/shared/components/DatePickerPill';
import { UseFormReturn } from 'react-hook-form';
import type { IssueFormData } from '../../types';

interface IssueDueDateFieldProps {
  form: UseFormReturn<IssueFormData>;
  pill?: boolean;
}

export function IssueDueDateField({ form, pill = false }: IssueDueDateFieldProps) {
  return (
    <FormField
      control={form.control}
      name="dueDate"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {pill ? (
              <DatePickerPill
                label="Due date"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            ) : (
              <SmartDatePickerField
                value={field.value ?? null}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
