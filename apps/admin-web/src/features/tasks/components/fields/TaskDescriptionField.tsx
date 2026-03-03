'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  RichTextEditor,
  type RichTextEditorRef,
  type JSONContent,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import type { TaskFormData } from '../../types';

interface TaskDescriptionFieldProps {
  form: UseFormReturn<TaskFormData>;
  value?: JSONContent | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  descriptionRef?: React.RefObject<RichTextEditorRef>;
}

export function TaskDescriptionField({ form, value: _value, onTagClick: _onTagClick, descriptionRef }: TaskDescriptionFieldProps) {
  const mentionSuggestions = useMentionSuggestions();

  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <RichTextEditor
              ref={descriptionRef}
              content={field.value || ''}
              onChange={field.onChange}
              placeholder="Add task description..."
              className="min-h-0"
              mentionSuggestions={mentionSuggestions}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
