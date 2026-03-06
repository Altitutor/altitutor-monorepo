'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useMentionField } from '@/shared/hooks/useMentionField';
import { MentionAutocomplete } from '@/shared/components/MentionAutocomplete';
import { useCallback } from 'react';
import type { EntitySearchResult } from '@/shared/hooks/useEntitySearch';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import type { ProjectFormData } from '../../types';

interface ProjectTitleFieldProps {
  form: UseFormReturn<ProjectFormData>;
  value?: string | null;
  onTagClick?: (type: TagEntityType, id: string) => void;
  onEnter?: () => void;
  titleRef?: React.RefObject<HTMLDivElement>;
}

export function ProjectTitleField({ form, value, onTagClick, onEnter, titleRef }: ProjectTitleFieldProps) {
  const handleTagClick = useCallback((tag: { type: TagEntityType; id: string }) => {
    onTagClick?.(tag.type, tag.id);
  }, [onTagClick]);

  const {
    ref: internalRef,
    handleBlur,
    handleInput,
    handleKeyDown,
    handlePaste,
    mentionQuery,
    mentionPosition,
    isMentionOpen,
    insertTag,
    closeMention,
    mentionPortalContainer,
  } = useMentionField({
    form,
    fieldName: 'name',
    value,
    onTagClick: handleTagClick,
    onEnter,
  });

  const handleSelectEntity = useCallback((result: EntitySearchResult) => {
    insertTag(result);
  }, [insertTag]);

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
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
                onPaste={handlePaste}
                data-placeholder="Project title"
                className="text-2xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] whitespace-nowrap overflow-hidden text-ellipsis empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
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
                  portalContainer={mentionPortalContainer}
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
