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
import type { TagEntityType } from '@/features/tasks/utils/tagParsing';

interface IssueDescriptionFieldProps {
  form: UseFormReturn<any>;
  value?: JSONContent | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  descriptionRef?: React.RefObject<RichTextEditorRef>;
}

export function IssueDescriptionField({ form, value, onTagClick, descriptionRef }: IssueDescriptionFieldProps) {
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
              placeholder="Add issue description..."
              className="min-h-[150px]"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
