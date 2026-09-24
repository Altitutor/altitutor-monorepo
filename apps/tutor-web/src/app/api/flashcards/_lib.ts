import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Flashcard } from '@altitutor/shared';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

type ServiceClient = SupabaseClient<Database>;

export async function assertTutorTopicAccess(topicId: string) {
  const userClient = createClient();
  const { data: isTutor } = await userClient.rpc('is_tutor');
  if (!isTutor) return false;
  const { data } = await userClient.from('vtutor_topics').select('id').eq('id', topicId).maybeSingle();
  return Boolean(data);
}

export async function listAccessibleFlashcards(topicId: string): Promise<Flashcard[]> {
  if (!(await assertTutorTopicAccess(topicId))) {
    throw new Error('Topic not accessible');
  }

  const userClient = createClient();
  const { data, error } = await userClient
    .from('vstaff_flashcards')
    .select('*')
    .eq('topic_id', topicId)
    .order('index', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as Flashcard[];
  const validRows = rows.filter((row): row is Flashcard => Boolean(row.id && row.topic_id && row.card_type && row.index != null));
  const storagePaths = validRows.flatMap((row) => (
    row.image_storage_path ? [row.image_storage_path] : []
  ));
  const serviceClient = getServiceRoleClient();
  const { data: signedUrls } = storagePaths.length > 0
    ? await serviceClient.storage.from('flashcard-images').createSignedUrls(storagePaths, 3600)
    : { data: [] };
  const signedUrlByPath = new Map(
    (signedUrls ?? []).flatMap((signed) => (
      signed.path ? [[signed.path, signed.signedUrl] as const] : []
    )),
  );
  return validRows.map((row) => (
    row.image_storage_path
      ? { ...row, image_url: signedUrlByPath.get(row.image_storage_path) ?? null }
      : row
  ));
}

export async function getAccessibleFlashcard(cardId: string): Promise<Flashcard | null> {
  const userClient = createClient();
  const { data, error } = await userClient
    .from('vstaff_flashcards')
    .select('*')
    .eq('id', cardId)
    .maybeSingle();

  if (error) throw error;
  const row = data as unknown as Flashcard | null;
  if (!row?.id || !row.topic_id || !row.card_type || row.index == null) return null;
  if (!(await assertTutorTopicAccess(row.topic_id))) return null;
  return row;
}

export function clampIndex(index: unknown, max: number) {
  const numeric = Number(index);
  if (!Number.isFinite(numeric)) return max;
  return Math.min(Math.max(Math.trunc(numeric), 1), max);
}

export async function persistTopicFlashcardOrder(
  serviceClient: ServiceClient,
  topicId: string,
  orderedIds: string[],
) {
  if (orderedIds.length === 0) return;

  const { error } = await serviceClient.rpc('tutor_reorder_topic_flashcards', {
    p_topic_id: topicId,
    p_ordered_ids: orderedIds,
  });
  if (error) throw error;
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
