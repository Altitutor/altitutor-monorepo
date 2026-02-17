'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useMentionField } from '../../../tasks/hooks/useMentionField';
import { MentionAutocomplete } from '../../../tasks/components/fields/MentionAutocomplete';
import { useCallback } from 'react';
import type { EntitySearchResult } from '@/shared/hooks/useEntitySearch';
import type { TagEntityType } from '../../../tasks/utils/tagParsing';

interface IssueTitleFieldProps {
  form: UseFormReturn<{ name: string }>;
  value?: string | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  onEnter?: () => void;
  titleRef?: React.RefObject<HTMLDivElement>;
}

export function IssueTitleField({ form, value, onTagClick, onEnter, titleRef }: IssueTitleFieldProps) {
  const handleTagClick = useCallback((tag: { type: TagEntityType; id: string }) => {
    onTagClick?.(tag.type, tag.id);
  }, [onTagClick]);

  const {
    ref: internalRef,
    handleBlur,
    handleInput,
    handleKeyDown,
    mentionQuery,
    mentionPosition,
    isMentionOpen,
    insertTag,
    closeMention,
  } = useMentionField({
    form: form as any,
    fieldName: 'name',
    value,
    onTagClick: handleTagClick,
    onEnter,
  });

  const handleSelectEntity = useCallback((result: EntitySearchResult) => {
    insertTag(result);
  }, [insertTag]);

  // Memoize ref callback to ensure stability
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    // Set internal ref (use type assertion since RefObject.current is read-only in types)
    (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    // Forward to titleRef if provided
    if (titleRef) {
      (titleRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [internalRef, titleRef]);

  return (
    <FormField
      control={form.control}
      name="name"
      render={() => (
        <FormItem>
          <FormControl>
            <div className="relative">
              <div
                ref={combinedRef}
                contentEditable
                onBlur={handleBlur}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                data-placeholder="Issue title"
                className="text-2xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
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
