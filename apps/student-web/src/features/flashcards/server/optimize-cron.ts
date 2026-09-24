import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { optimizeFsrsParameters } from '@/features/flashcards/server/optimizer';

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getServerSupabaseAdmin();
  const { data: preferences, error } = await admin.rpc('flashcard_optimizer_candidates', {
    p_now: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let optimized = 0;
  for (const preference of preferences ?? []) {
    const { data: logs, error: logsError } = await admin
      .from('student_flashcard_review_logs')
      .select('review_card_id,rating,answered_at,reset_generation')
      .eq('student_id', preference.student_id)
      .eq('preset_id', preference.preset_id)
      .eq('action', 'answer')
      .is('undone_at', null)
      .order('answered_at');
    if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 });
    if (!logs || logs.length < 1000) continue;

    const ids = [...new Set(logs.map((log) => log.review_card_id))];
    const [statesResult, cardsResult] = await Promise.all([
      admin
        .from('student_flashcard_review_states')
        .select('review_card_id,reset_generation')
        .eq('student_id', preference.student_id)
        .in('review_card_id', ids),
      admin.from('flashcard_review_cards').select('id,deleted_at').in('id', ids),
    ]);
    const sourceError = statesResult.error ?? cardsResult.error;
    if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });

    const generation = new Map(
      (statesResult.data ?? []).map((state) => [state.review_card_id, state.reset_generation]),
    );
    const active = new Set(
      (cardsResult.data ?? []).filter((card) => !card.deleted_at).map((card) => card.id),
    );
    const eligible = logs
      .filter(
        (log) =>
          active.has(log.review_card_id)
          && generation.get(log.review_card_id) === log.reset_generation
          && log.rating,
      )
      .map((log) => ({
        reviewCardId: log.review_card_id,
        rating: log.rating as 'again' | 'hard' | 'good' | 'easy',
        answeredAt: log.answered_at,
      }));
    if (eligible.length < 1000) continue;

    const { data: presetVersion, error: presetError } = await admin
      .from('flashcard_study_preset_versions')
      .select('relearning_steps_minutes')
      .eq('preset_id', preference.preset_id)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    if (presetError) return NextResponse.json({ error: presetError.message }, { status: 500 });

    const parameters = await optimizeFsrsParameters(eligible, {
      numRelearningSteps: presetVersion.relearning_steps_minutes.length,
    });
    const { error: upsertError } = await admin
      .from('student_flashcard_preset_preferences')
      .upsert({
        student_id: preference.student_id,
        preset_id: preference.preset_id,
        optimized_fsrs_parameters: parameters,
        optimizer_eligible_reviews: eligible.length,
        optimized_at: new Date().toISOString(),
      });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
    optimized += 1;
  }

  return NextResponse.json({ data: { optimized } });
}
