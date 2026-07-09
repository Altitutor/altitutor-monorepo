'use client';

import { Calendar } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
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
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(event) => field.onChange(event.target.value || null)}
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
