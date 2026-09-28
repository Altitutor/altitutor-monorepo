import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatedFlashcardClient } from '@/features/flashcards/server/user-client';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { DEFAULT_FLASHCARD_STUDY_PRESET_ID, type FlashcardRating, type FlashcardReviewCard } from '@altitutor/shared';
import { createHash } from 'node:crypto';
import { buildRatingPreviews, DEFAULT_FLASHCARD_STUDY_PRESET, flashcardSchedulerVersion, ratingMap, scheduleReview, stateName, type FlashcardStudyPresetConfig, type ReviewStateRow } from '@/features/flashcards/server/fsrs';


function isFlashcardRating(value: unknown): value is FlashcardRating {
  return typeof value === 'string' && value in ratingMap;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as { rating?: unknown; requestId?: unknown; expectedRevision?: unknown; durationMs?: unknown; previewSeed?: unknown; answeredAt?: unknown };
  const rating = body.rating;
  if (!isFlashcardRating(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }
  if (typeof body.requestId !== 'string' || typeof body.expectedRevision !== 'number' || typeof body.durationMs !== 'number' || typeof body.previewSeed !== 'string' || typeof body.answeredAt !== 'string' || !Number.isFinite(Date.parse(body.answeredAt))) {
    return NextResponse.json({ error: 'Invalid answer command' }, { status: 400 });
  }

  const userClient = await authenticatedFlashcardClient(request);
  if (!userClient) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: studentId, error: studentError } = await userClient.rpc('current_student_id');
  if (studentError || !studentId) return NextResponse.json({ error: 'student_not_found' }, { status: 403 });

  const { data: accessibleCard, error: accessError } = await userClient
    .from('vstudent_flashcard_review_cards')
    .select('id, topic_id')
    .eq('id', params.id)
    .maybeSingle();
  if (accessError) return captureApiErrorResponse(accessError, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: accessError.message }, { status: 500 }));
  if (!accessibleCard) return NextResponse.json({ error: 'flashcard_review_card_not_accessible' }, { status: 404 });

  if (!accessibleCard.topic_id) return NextResponse.json({ error: 'flashcard_topic_not_found' }, { status: 404 });
  const adminClient = getServerSupabaseAdmin({ retry: false });
  const { data: topic, error: topicError } = await adminClient.from('topics').select('subject_id').eq('id', accessibleCard.topic_id).single();
  if (topicError || !topic?.subject_id) return captureApiErrorResponse(topicError ?? new Error('flashcard_subject_not_found'), '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: 'Unable to resolve flashcard subject' }, { status: 500 }));
  const { data: assignment, error: assignmentError } = await adminClient.from('subject_flashcard_study_presets').select('preset_id').eq('subject_id', topic.subject_id).maybeSingle();
  if (assignmentError) return captureApiErrorResponse(assignmentError, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: assignmentError.message }, { status: 500 }));
  const presetId = assignment?.preset_id ?? DEFAULT_FLASHCARD_STUDY_PRESET_ID;
  const { data: presetVersion, error: presetError } = await adminClient.from('flashcard_study_preset_versions')
    .select('version, desired_retention, learning_steps_minutes, relearning_steps_minutes, minimum_lapse_interval_days, learn_ahead_minutes, leech_threshold, leech_reminder_interval, fsrs_parameters')
    .eq('preset_id', presetId).order('version', { ascending: false }).limit(1).single();
  if (presetError) return captureApiErrorResponse(presetError, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: presetError.message }, { status: 500 }));
  const { data: personalPreset, error: personalPresetError } = await adminClient.from('student_flashcard_preset_preferences')
    .select('desired_retention, optimized_fsrs_parameters').eq('student_id', studentId).eq('preset_id', presetId).maybeSingle();
  if (personalPresetError) return captureApiErrorResponse(personalPresetError, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: personalPresetError.message }, { status: 500 }));
  const preset: FlashcardStudyPresetConfig = {
    desiredRetention: Number(personalPreset?.desired_retention ?? presetVersion.desired_retention),
    learningStepsMinutes: presetVersion.learning_steps_minutes,
    relearningStepsMinutes: presetVersion.relearning_steps_minutes,
    minimumLapseIntervalDays: presetVersion.minimum_lapse_interval_days,
    fsrsParameters: (personalPreset?.optimized_fsrs_parameters as number[] | null) ?? (presetVersion.fsrs_parameters as number[]) ?? DEFAULT_FLASHCARD_STUDY_PRESET.fsrsParameters,
  };
  const { data: receipt, error: receiptError } = await adminClient
    .from('student_flashcard_review_logs')
    .select('id, review_card_id, action, rating, answered_at, duration_ms, pre_revision, pre_state, result')
    .eq('student_id', studentId)
    .eq('request_id', body.requestId)
    .maybeSingle();
  if (receiptError) return captureApiErrorResponse(receiptError, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: receiptError.message }, { status: 500 }));
  if (receipt) {
    const receiptResult = receipt.result as { leechSuggested?: boolean; previewSeed?: string; studyDayEndsAt?: string };
    const sameCommand = receipt.review_card_id === params.id && receipt.action === 'answer' && receipt.rating === rating
      && receipt.pre_revision === body.expectedRevision && receipt.duration_ms === Math.min(60000, Math.max(0, Math.round(body.durationMs)))
      && new Date(receipt.answered_at).getTime() === new Date(body.answeredAt).getTime() && receiptResult.previewSeed === body.previewSeed;
    if (!sameCommand) return NextResponse.json({ error: 'flashcard_idempotency_conflict' }, { status: 409 });
    const { data: replayedCard, error: replayError } = await userClient.from('vstudent_flashcard_review_cards').select('*').eq('id', params.id).single();
    if (replayError) return captureApiErrorResponse(replayError, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: replayError.message }, { status: 500 }));
    const row = replayedCard as FlashcardReviewCard;
    const replayPreviewSeed = createHash('sha256').update(`${row.id}:${row.revision}:${row.due_at}`).digest('hex');
    const buriedSiblingIds = await loadBuriedSiblingIds(adminClient, row.flashcard_id, row.id);
    return NextResponse.json({ data: { ...row, rating_preview_seed: replayPreviewSeed,
      answer_log_id: receipt.id,
      buried_sibling_ids: buriedSiblingIds,
      study_day_ends_at: receiptResult.studyDayEndsAt,
      leech_suggested: Boolean(receiptResult.leechSuggested),
      rating_previews: buildRatingPreviews(
        row as ReviewStateRow,
        new Date(receipt.answered_at),
        preset,
        replayPreviewSeed,
        receiptResult.studyDayEndsAt ? new Date(receiptResult.studyDayEndsAt) : undefined,
      ) } });
  }
  const { data: existingState, error: stateError } = await adminClient
    .from('student_flashcard_review_states')
    .select('due_at, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_reviewed_at, revision')
    .eq('student_id', studentId)
    .eq('review_card_id', params.id)
    .maybeSingle();
  if (stateError) return captureApiErrorResponse(stateError, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: stateError.message }, { status: 500 }));

  const now = new Date(body.answeredAt);
  if (now.getTime() > Date.now() + 5 * 60_000) return NextResponse.json({ error: 'Answer timestamp is in the future' }, { status: 400 });
  if (Date.now() - now.getTime() > 5 * 60_000) return NextResponse.json({ error: 'flashcard_command_expired' }, { status: 409 });
  const { data: studentPreferences, error: preferencesError } = await adminClient.from('student_flashcard_preferences').select('timezone').eq('student_id', studentId).maybeSingle();
  if (preferencesError) return captureApiErrorResponse(preferencesError, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: preferencesError.message }, { status: 500 }));
  const { data: studyDayBounds, error: studyDayError } = await adminClient.rpc('flashcard_study_day_bounds', {
    p_now: now.toISOString(), p_timezone: studentPreferences?.timezone ?? 'Australia/Adelaide',
  });
  if (studyDayError || !studyDayBounds?.[0]) return NextResponse.json({ error: 'Unable to resolve study day' }, { status: 500 });
  const currentRevision = existingState?.revision ?? 0;
  if (currentRevision !== body.expectedRevision) return NextResponse.json({ error: 'flashcard_stale_revision' }, { status: 409 });
  const fuzzSeed = body.previewSeed;
  const result = scheduleReview(
    existingState as ReviewStateRow | null,
    now,
    rating,
    preset,
    fuzzSeed,
    new Date(studyDayBounds[0].ends_at),
  );
  const nextCard = result.card;
  const nextState = { due_at: nextCard.due.toISOString(), stability: nextCard.stability, difficulty: nextCard.difficulty,
    scheduled_days: nextCard.scheduled_days, learning_steps: nextCard.learning_steps, reps: nextCard.reps,
    lapses: nextCard.lapses, state: stateName(nextCard.state) };
  const fingerprint = createHash('sha256').update(JSON.stringify({ reviewCardId: params.id, rating, expectedRevision: body.expectedRevision, previewSeed: body.previewSeed, nextState })).digest('hex');
  const { data: commitResult, error } = await adminClient.rpc('commit_flashcard_review_answer', {
    p_student_id: studentId, p_review_card_id: params.id, p_request_id: body.requestId,
    p_request_fingerprint: fingerprint, p_expected_revision: body.expectedRevision, p_answered_at: now.toISOString(),
    p_duration_ms: Math.min(60000, Math.max(0, Math.round(body.durationMs))), p_rating: rating,
    p_preset_id: presetId, p_preset_version: presetVersion.version, p_scheduler_version: flashcardSchedulerVersion,
    p_next_state: nextState, p_result: { due_at: nextCard.due.toISOString(), previewSeed: body.previewSeed, studyDayEndsAt: studyDayBounds[0].ends_at, learnAheadMinutes: presetVersion.learn_ahead_minutes, leechThreshold: presetVersion.leech_threshold, leechReminderInterval: presetVersion.leech_reminder_interval },
  });
  if (error) {
    const status = error.code === 'PT409' || error.code === '40001' ? 409 : 500;
    return captureApiErrorResponse(error, '/api/flashcards/review-cards/[id]/rate', NextResponse.json({ error: error.message }, { status }));
  }

  const { data: updatedCard, error: cardError } = await userClient
    .from('vstudent_flashcard_review_cards')
    .select('*')
    .eq('id', params.id)
    .single();
  if (cardError) return captureApiErrorResponse(cardError, "/api/flashcards/review-cards/[id]/rate", NextResponse.json({ error: cardError.message }, { status: 500 }));

  const row = updatedCard as FlashcardReviewCard;
  const answerReceipt = commitResult as { leechSuggested?: boolean; reviewLogId?: string } | null;
  const nextPreviewSeed = createHash('sha256').update(`${row.id}:${row.revision}:${row.due_at}`).digest('hex');
  const buriedSiblingIds = await loadBuriedSiblingIds(adminClient, row.flashcard_id, row.id);
  return NextResponse.json({
    data: {
      ...row,
      rating_preview_seed: nextPreviewSeed,
      answer_log_id: answerReceipt?.reviewLogId,
      buried_sibling_ids: buriedSiblingIds,
      study_day_ends_at: studyDayBounds[0].ends_at,
      leech_suggested: Boolean(answerReceipt?.leechSuggested),
      rating_previews: buildRatingPreviews(
        row as ReviewStateRow,
        now,
        preset,
        nextPreviewSeed,
        new Date(studyDayBounds[0].ends_at),
      ),
    },
  });
}

async function loadBuriedSiblingIds(
  adminClient: ReturnType<typeof getServerSupabaseAdmin>,
  flashcardId: string,
  reviewCardId: string,
): Promise<string[]> {
  const { data, error } = await adminClient
    .from('flashcard_review_cards')
    .select('id')
    .eq('flashcard_id', flashcardId)
    .neq('id', reviewCardId)
    .is('deleted_at', null);
  if (error) {
    captureApiError(error, '/api/flashcards/review-cards/[id]/rate');
    return [];
  }
  return (data ?? []).map((sibling) => sibling.id);
}
