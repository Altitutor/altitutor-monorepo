'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { TaskEditor, type TaskEditorRef } from '../TaskEditor';
import type { TagEntityType } from '../../utils/tagParsing';

interface TaskDescriptionFieldProps {
  form: UseFormReturn<{ description?: string }>;
  value?: string | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  descriptionRef?: React.RefObject<TaskEditorRef>;
}

export function TaskDescriptionField({ form, value, onTagClick, descriptionRef }: TaskDescriptionFieldProps) {
  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <TaskEditor
              ref={descriptionRef}
              content={field.value || ''}
              onChange={field.onChange}
              placeholder="Add description..."
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
