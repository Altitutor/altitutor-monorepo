import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { createEmptyCard, fsrs, Rating, State, type Card, type CardInput } from 'ts-fsrs';

const scheduler = fsrs();

const ratingMap: Record<string, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

type ReviewStateRow = {
  due_at: string;
  stability: number | null;
  difficulty: number | null;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
  last_reviewed_at: string | null;
};

function stateName(state: State): ReviewStateRow['state'] {
  return State[state] as ReviewStateRow['state'];
}

function toFsrsCard(state: ReviewStateRow | null, now: Date): CardInput | Card {
  if (!state) return createEmptyCard(now);
  if (state.state === 'New' && state.stability == null && state.difficulty == null) {
    return createEmptyCard(now);
  }
  return {
    due: state.due_at,
    stability: Number(state.stability ?? 0),
    difficulty: Number(state.difficulty ?? 0),
    elapsed_days: 0,
    scheduled_days: state.scheduled_days ?? 0,
    learning_steps: state.learning_steps ?? 0,
    reps: state.reps ?? 0,
    lapses: state.lapses ?? 0,
    state: state.state,
    last_review: state.last_reviewed_at,
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as { rating?: unknown };
  const rating = body.rating;
  if (typeof rating !== 'string' || !ratingMap[rating]) {
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
  if (accessError) return NextResponse.json({ error: accessError.message }, { status: 500 });
  if (!accessibleCard) return NextResponse.json({ error: 'flashcard_review_card_not_accessible' }, { status: 404 });

  const adminClient = getServerSupabaseAdmin();
  const { data: existingState, error: stateError } = await adminClient
    .from('student_flashcard_review_states')
    .select('due_at, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_reviewed_at')
    .eq('student_id', studentId)
    .eq('review_card_id', params.id)
    .maybeSingle();
  if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });

  const now = new Date();
  const result = scheduler.next(toFsrsCard(existingState as ReviewStateRow | null, now), now, ratingMap[rating]);
  const nextCard = result.card;

  const { data, error } = await adminClient
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
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
