import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { buildRatingPreviews, type ReviewStateRow } from '@/features/flashcards/server/fsrs';
import type { FlashcardReviewCard } from '@altitutor/shared';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  const topicIds = request.nextUrl.searchParams
    .get('topicIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const mode = request.nextUrl.searchParams.get('mode') === 'all' ? 'all' : 'due';

  const userClient = createClient();
  let query = userClient
    .from('vstudent_flashcard_review_cards')
    .select('*')
    .order('flashcard_index', { ascending: true })
    .order('cloze_index', { ascending: true });

  if (topicId) {
    query = query.eq('topic_id', topicId);
  } else if (topicIds?.length) {
    query = query.in('topic_id', topicIds);
  }

  if (mode === 'due') {
    query = query.lte('due_at', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) return captureApiErrorResponse(error, "/api/flashcards/review-cards", NextResponse.json({ error: error.message }, { status: 500 }));
  const now = new Date();
  const rawRows = (data ?? []) as unknown as FlashcardReviewCard[];
  const adminClient = getServerSupabaseAdmin();
  const imageUrls = new Map<string, string>();
  await Promise.all([...new Set(rawRows.map((row) => row.image_storage_path).filter((path): path is string => Boolean(path)))].map(async (path) => {
    const { data: signed } = await adminClient.storage.from('flashcard-images').createSignedUrl(path, 3600);
    if (signed?.signedUrl) imageUrls.set(path, signed.signedUrl);
  }));
  const rows = rawRows.map((row) => ({
    ...row,
    image_url: row.image_storage_path ? imageUrls.get(row.image_storage_path) ?? null : null,
    rating_previews: buildRatingPreviews(row as ReviewStateRow, now),
  }));
  return NextResponse.json({ data: rows });
}
