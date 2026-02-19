import { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { parseTags } from '@/shared/utils/tagParsing';
import { extractMentions } from '@/shared/utils/extractMentions';
import type { JSONContent } from '@altitutor/ui';
import type { IssueTagInsert } from '../types';

interface UseLiveIssueTagsOptions {
  form: UseFormReturn<any>;
  initialTags?: any[];
}

/**
 * Hook to extract and merge tags from form fields (title and description)
 * and combine them with initial tags.
 */
export function useLiveIssueTags({ form, initialTags = [] }: UseLiveIssueTagsOptions) {
  const nameValue = form.watch('name');
  const descriptionValue = form.watch('description');

  return useMemo(() => {
    // 1. Parse tags from name (plain text with @[type:id:text])
    const nameTags = parseTags(nameValue || '').map(tag => ({
      [`${tag.type}_id`]: tag.id,
    }));

    // 2. Extract mentions from description (JSON content)
    const descriptionMentions = extractMentions(descriptionValue).map(mention => ({
      [`${mention.type}_id`]: mention.id,
    }));

    // 3. Combine all tags
    const allTags = [
      ...initialTags,
      ...nameTags,
      ...descriptionMentions,
    ];

    // 4. De-duplicate tags by their ID fields
    const uniqueTagsMap = new Map<string, any>();
    
    allTags.forEach(tag => {
      // Find the entity ID field (e.g., student_id, staff_id, etc.)
      const idKey = Object.keys(tag).find(key => key.endsWith('_id') && (tag as any)[key]);
      if (idKey) {
        const idValue = (tag as any)[idKey];
        const uniqueKey = `${idKey}:${idValue}`;
        if (!uniqueTagsMap.has(uniqueKey)) {
          uniqueTagsMap.set(uniqueKey, tag);
        }
      } else if (tag.conversation_id || tag.message_id) {
        const key = tag.conversation_id ? `conv:${tag.conversation_id}` : `msg:${tag.message_id}`;
        if (!uniqueTagsMap.has(key)) {
          uniqueTagsMap.set(key, tag);
        }
      }
    });

    return Array.from(uniqueTagsMap.values());
  }, [nameValue, descriptionValue, initialTags]);
}
