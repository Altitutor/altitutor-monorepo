'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useContentEditableField } from '../../hooks/useContentEditableField';

interface TaskDescriptionFieldProps {
  form: UseFormReturn<{ description?: string }>;
  value?: string | null;
}

export function TaskDescriptionField({ form, value }: TaskDescriptionFieldProps) {
  const { ref, handleBlur, handleInput } = useContentEditableField(
    form,
    'description',
    value
  );

  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div
              ref={ref}
              contentEditable
              onBlur={handleBlur}
              onInput={handleInput}
              data-placeholder="Add description..."
              className="text-sm text-foreground outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[100px] whitespace-pre-wrap break-words leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
              suppressContentEditableWarning
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
