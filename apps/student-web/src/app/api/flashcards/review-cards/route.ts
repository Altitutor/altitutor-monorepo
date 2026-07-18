import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
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
  const rows = ((data ?? []) as FlashcardReviewCard[]).map((row) => ({
    ...row,
    rating_previews: buildRatingPreviews(row as ReviewStateRow, now),
  }));
  return NextResponse.json({ data: rows });
}
