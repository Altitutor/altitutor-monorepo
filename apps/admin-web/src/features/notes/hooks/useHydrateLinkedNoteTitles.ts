import { useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { JSONContent } from '@tiptap/core';
import { notesApi } from '../api/notes';
import type { NoteFormData } from '../types';
import {
  applyLinkedNoteTitles,
  collectLinkedNoteIds,
} from '../utils/hydrateNoteMentionLabels';

interface UseHydrateLinkedNoteTitlesArgs {
  form: UseFormReturn<NoteFormData>;
  noteId: string | null | undefined;
  isInitialized: boolean;
  isUpdatingFromServerRef: React.MutableRefObject<boolean>;
}

/**
 * After a document loads into the form, batch-fetch titles for linked notes and
 * refresh mention labels when they drift (rename).
 */
export function useHydrateLinkedNoteTitles({
  form,
  noteId,
  isInitialized,
  isUpdatingFromServerRef,
}: UseHydrateLinkedNoteTitlesArgs): void {
  const generationRef = useRef(0);

  useEffect(() => {
    if (!noteId || !isInitialized) return;

    const content = form.getValues('content') as JSONContent | string | null | undefined;
    let json: JSONContent | null = null;
    if (content && typeof content === 'object' && 'type' in content && content.type === 'doc') {
      json = content as JSONContent;
    }
    if (!json) return;

    const ids = collectLinkedNoteIds(json);
    if (ids.length === 0) return;

    const gen = ++generationRef.current;
    let cancelled = false;

    notesApi.getTitlesForIds(ids).then((titles) => {
      if (cancelled || gen !== generationRef.current) return;
      const next = applyLinkedNoteTitles(json as JSONContent, titles);
      if (JSON.stringify(next) === JSON.stringify(json)) return;

      isUpdatingFromServerRef.current = true;
      form.setValue('content', next, { shouldDirty: true, shouldTouch: false });
      queueMicrotask(() => {
        isUpdatingFromServerRef.current = false;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [form, noteId, isInitialized, isUpdatingFromServerRef]);
}
