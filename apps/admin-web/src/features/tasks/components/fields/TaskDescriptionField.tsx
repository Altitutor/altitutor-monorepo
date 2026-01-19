'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useMentionField } from '../../hooks/useMentionField';
import { MentionAutocomplete } from './MentionAutocomplete';
import { useCallback } from 'react';
import type { EntitySearchResult } from '@/shared/hooks/useEntitySearch';
import type { TagEntityType } from '../../utils/tagParsing';

interface TaskDescriptionFieldProps {
  form: UseFormReturn<{ description?: string }>;
  value?: string | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
}

export function TaskDescriptionField({ form, value, onTagClick }: TaskDescriptionFieldProps) {
  const handleTagClick = useCallback((tag: { type: TagEntityType; id: string }) => {
    onTagClick?.(tag.type, tag.id);
  }, [onTagClick]);

  const {
    ref,
    handleBlur,
    handleInput,
    handleKeyDown,
    mentionQuery,
    mentionPosition,
    isMentionOpen,
    insertTag,
    closeMention,
  } = useMentionField({
    form,
    fieldName: 'description',
    value,
    onTagClick: handleTagClick,
  });

  const handleSelectEntity = useCallback((result: EntitySearchResult) => {
    insertTag(result);
  }, [insertTag]);

  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div className="relative">
              <div
                ref={ref}
                contentEditable
                onBlur={handleBlur}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                data-placeholder="Add description..."
                className="text-sm text-foreground outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[100px] whitespace-pre-wrap break-words leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                suppressContentEditableWarning
              />
              {isMentionOpen && mentionPosition && (
                <MentionAutocomplete
                  searchQuery={mentionQuery}
                  isOpen={isMentionOpen}
                  onSelect={handleSelectEntity}
                  onClose={closeMention}
                  position={{
                    top: mentionPosition.top,
                    left: mentionPosition.left,
                  }}
                />
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
