import { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { parseTags } from '@/shared/utils/tagParsing';
import { extractMentions } from '@/shared/utils/extractMentions';
import type { IssueFormData, IssueTagInsert } from '../types';

interface UseLiveIssueTagsOptions {
  form: UseFormReturn<IssueFormData>;
  initialTags?: Omit<IssueTagInsert, 'issue_id'>[];
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
    const uniqueTagsMap = new Map<string, Record<string, unknown>>();
    
    allTags.forEach(tag => {
      // Find the entity ID field (e.g., student_id, staff_id, etc.)
      const tagRecord = tag as Record<string, unknown>;
      const idKey = Object.keys(tagRecord).find(key => key.endsWith('_id') && tagRecord[key]);
      if (idKey) {
        const idValue = tagRecord[idKey];
        const uniqueKey = `${idKey}:${idValue}`;
        if (!uniqueTagsMap.has(uniqueKey)) {
          uniqueTagsMap.set(uniqueKey, tag);
        }
      }
    });

    return Array.from(uniqueTagsMap.values());
  }, [nameValue, descriptionValue, initialTags]);
}
