import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

type ServiceClient = SupabaseClient<Database>;

export function clampIndex(index: unknown, max: number) {
  const numeric = Number(index);
  if (!Number.isFinite(numeric)) return max;
  return Math.min(Math.max(Math.trunc(numeric), 1), max);
}

export function insertIdAtIndex(ids: string[], id: string, index: number) {
  const withoutId = ids.filter((item) => item !== id);
  const insertionIndex = clampIndex(index, withoutId.length + 1) - 1;
  return [
    ...withoutId.slice(0, insertionIndex),
    id,
    ...withoutId.slice(insertionIndex),
  ];
}

export async function persistTopicFlashcardOrder(
  serviceClient: ServiceClient,
  topicId: string,
  orderedIds: string[],
) {
  if (orderedIds.length === 0) return;

  const { data: existingIndexes, error: existingIndexesError } = await serviceClient
    .from('flashcards')
    .select('index')
    .eq('topic_id', topicId)
    .is('deleted_at', null);
  if (existingIndexesError) throw existingIndexesError;

  const parkingStart = Math.max(
    orderedIds.length,
    ...(existingIndexes ?? []).map((row) => row.index ?? 0),
  ) + 1;

  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await serviceClient
      .from('flashcards')
      .update({ index: parkingStart + i, updated_at: new Date().toISOString() })
      .eq('id', orderedIds[i])
      .eq('topic_id', topicId);
    if (error) throw error;
  }

  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await serviceClient
      .from('flashcards')
      .update({ index: i + 1, updated_at: new Date().toISOString() })
      .eq('id', orderedIds[i])
      .eq('topic_id', topicId);
    if (error) throw error;
  }
}
