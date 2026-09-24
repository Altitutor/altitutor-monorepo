'use client';

import { useRef } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  type RichTextEditorRef,
  type JSONContent,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import { AdminRichTextEditorWithImages } from '@/features/rich-text-images';
import type { TaskFormData } from '../../types';

interface TaskDescriptionFieldProps {
  form: UseFormReturn<TaskFormData>;
  value?: JSONContent | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  descriptionRef?: React.RefObject<RichTextEditorRef>;
}

export function TaskDescriptionField({
  form,
  value: _value,
  onTagClick: _onTagClick,
  descriptionRef,
}: TaskDescriptionFieldProps) {
  const mentionSuggestions = useMentionSuggestions();
  const localRef = useRef<RichTextEditorRef>(null);
  const effectiveRef = descriptionRef ?? localRef;

  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <AdminRichTextEditorWithImages
              ref={effectiveRef}
              content={field.value || ''}
              onChange={field.onChange}
              onChangeDebounceMs={200}
              placeholder="Add task description..."
              className="min-h-0"
              context="tasks"
              mentionSuggestions={mentionSuggestions}
              floatingToolbar
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
