import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import type { FlashcardRating, FlashcardReviewCard } from '@altitutor/shared';
import { buildRatingPreviews, ratingMap, scheduler, stateName, toFsrsCard, type ReviewStateRow } from '@/features/flashcards/server/fsrs';

function isFlashcardRating(value: unknown): value is FlashcardRating {
  return typeof value === 'string' && value in ratingMap;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as { rating?: unknown };
  const rating = body.rating;
  if (!isFlashcardRating(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

  const userClient = createClient();
  const { data: studentId, error: studentError } = await userClient.rpc('current_student_id');
  if (studentError || !studentId) return NextResponse.json({ error: 'student_not_found' }, { status: 403 });

  const { data: accessibleCard, error: accessError } = await userClient
    .from('vstudent_flashcard_review_cards')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (accessError) return captureApiErrorResponse(accessError, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: accessError.message }, { status: 500 }));
  if (!accessibleCard) return NextResponse.json({ error: 'flashcard_review_card_not_accessible' }, { status: 404 });

  const adminClient = getServerSupabaseAdmin();
  const { data: existingState, error: stateError } = await adminClient
    .from('student_flashcard_review_states')
    .select('due_at, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_reviewed_at')
    .eq('student_id', studentId)
    .eq('review_card_id', params.id)
    .maybeSingle();
  if (stateError) return captureApiErrorResponse(stateError, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: stateError.message }, { status: 500 }));

  const now = new Date();
  const result = scheduler.next(toFsrsCard(existingState as ReviewStateRow | null, now), now, ratingMap[rating]);
  const nextCard = result.card;

  const { error } = await adminClient
    .from('student_flashcard_review_states')
    .upsert(
      {
        student_id: studentId,
        review_card_id: params.id,
        due_at: nextCard.due.toISOString(),
        stability: nextCard.stability,
        difficulty: nextCard.difficulty,
        scheduled_days: nextCard.scheduled_days,
        learning_steps: nextCard.learning_steps,
        reps: nextCard.reps,
        lapses: nextCard.lapses,
        state: stateName(nextCard.state),
        last_reviewed_at: now.toISOString(),
        last_rating: rating,
        updated_at: now.toISOString(),
      },
      { onConflict: 'student_id,review_card_id' },
    )
    .select('id')
    .single();

  if (error) return captureApiErrorResponse(error, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: error.message }, { status: 500 }));

  const { data: updatedCard, error: cardError } = await userClient
    .from('vstudent_flashcard_review_cards')
    .select('*')
    .eq('id', params.id)
    .single();
  if (cardError) return captureApiErrorResponse(cardError, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: cardError.message }, { status: 500 }));

  const row = updatedCard as FlashcardReviewCard;
  return NextResponse.json({
    data: {
      ...row,
      rating_previews: buildRatingPreviews(row as ReviewStateRow, now),
    },
  });
}
