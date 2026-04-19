'use client';

import { useRef } from 'react';
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
import { useSlashCommandSuggestions } from '@/shared/hooks/useSlashCommandSuggestions';
import { useAdminRichTextImageUpload } from '@/features/rich-text-images';
import type { IssueFormData } from '../../types';

interface IssueDescriptionFieldProps {
  form: UseFormReturn<IssueFormData>;
  value?: JSONContent | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  descriptionRef?: React.RefObject<RichTextEditorRef>;
}

export function IssueDescriptionField({ form, value: _value, onTagClick: _onTagClick, descriptionRef }: IssueDescriptionFieldProps) {
  const mentionSuggestions = useMentionSuggestions();
  const slashMenuSuggestions = useSlashCommandSuggestions();
  const localRef = useRef<RichTextEditorRef>(null);
  const effectiveRef = descriptionRef ?? localRef;
  const { handlePasteImages, handleDrop } = useAdminRichTextImageUpload({
    context: 'issues',
    editorRef: effectiveRef,
  });

  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <RichTextEditor
                ref={effectiveRef}
                content={field.value || ''}
                onChange={field.onChange}
                placeholder="Add issue description..."
                className="min-h-0"
                mentionSuggestions={mentionSuggestions}
                slashMenuSuggestions={slashMenuSuggestions}
                onPasteImages={handlePasteImages}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
