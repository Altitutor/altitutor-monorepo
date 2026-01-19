'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useContentEditableField } from '../../hooks/useContentEditableField';

interface TaskTitleFieldProps {
  form: UseFormReturn<{ title: string }>;
  value?: string | null;
}

export function TaskTitleField({ form, value }: TaskTitleFieldProps) {
  const { ref, handleBlur, handleInput } = useContentEditableField(
    form,
    'title',
    value
  );

  return (
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div
              ref={ref}
              contentEditable
              onBlur={handleBlur}
              onInput={handleInput}
              data-placeholder="Task title"
              className="text-2xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
              suppressContentEditableWarning
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
