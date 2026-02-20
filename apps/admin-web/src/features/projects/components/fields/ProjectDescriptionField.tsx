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
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import type { ProjectFormData } from '../../types';

interface ProjectDescriptionFieldProps {
  form: UseFormReturn<ProjectFormData>;
  value?: JSONContent | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  descriptionRef?: React.RefObject<RichTextEditorRef>;
}

export function ProjectDescriptionField({ form, descriptionRef }: ProjectDescriptionFieldProps) {
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
              placeholder="Add project description..."
              className="min-h-0"
              mentionSuggestions={mentionSuggestions as any}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
