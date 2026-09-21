-- Undo must target the exact immutable answer receipt returned to the client.
-- This prevents repeated UI clicks from walking backwards through unrelated
-- history and avoids the latest-active-answer scan on every command.
CREATE OR REPLACE FUNCTION public.undo_flashcard_answer(
  p_student_id UUID,
  p_answer_log_id UUID,
  p_request_id UUID,
  p_request_fingerprint TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_answer public.student_flashcard_review_logs;
  v_existing public.student_flashcard_review_logs;
  v_state public.student_flashcard_review_states;
  v_revision BIGINT;
BEGIN
  -- Replays should not wait behind another command for the same Student.
  SELECT * INTO v_existing
  FROM public.student_flashcard_review_logs
  WHERE student_id = p_student_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'flashcard_idempotency_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.result || jsonb_build_object('replayed', true, 'reviewLogId', v_existing.id);
  END IF;

  -- Fail fast instead of consuming a PostgREST/database connection while a
  -- rating or another undo for this Student owns the scheduling lock.
  IF NOT pg_try_advisory_xact_lock(hashtextextended(p_student_id::TEXT, 7319)) THEN
    RAISE EXCEPTION 'flashcard_command_in_progress' USING ERRCODE = '55P03';
  END IF;

  -- Close the small race between the initial replay check and lock acquisition.
  SELECT * INTO v_existing
  FROM public.student_flashcard_review_logs
  WHERE student_id = p_student_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'flashcard_idempotency_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.result || jsonb_build_object('replayed', true, 'reviewLogId', v_existing.id);
  END IF;

  SELECT * INTO v_answer
  FROM public.student_flashcard_review_logs
  WHERE id = p_answer_log_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_answer.student_id <> p_student_id
    OR v_answer.action <> 'answer'
    OR v_answer.undone_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'flashcard_answer_not_undoable' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_state
  FROM public.student_flashcard_review_states
  WHERE student_id = p_student_id
    AND review_card_id = v_answer.review_card_id
  FOR UPDATE;

  IF NOT FOUND OR v_state.revision <> v_answer.post_revision THEN
    RAISE EXCEPTION 'flashcard_undo_conflict' USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_answer.result->'_siblingPre', '[]'::JSONB)) prior
    JOIN public.student_flashcard_review_states sibling
      ON sibling.student_id = p_student_id
     AND sibling.review_card_id = (prior->>'review_card_id')::UUID
    WHERE sibling.revision <> (prior->>'revision')::BIGINT + 1
  ) THEN
    RAISE EXCEPTION 'flashcard_undo_conflict' USING ERRCODE = '40001';
  END IF;

  v_revision := v_state.revision + 1;

  UPDATE public.student_flashcard_review_states
  SET due_at = (v_answer.pre_state->>'due_at')::TIMESTAMPTZ,
      stability = (v_answer.pre_state->>'stability')::NUMERIC,
      difficulty = (v_answer.pre_state->>'difficulty')::NUMERIC,
      scheduled_days = (v_answer.pre_state->>'scheduled_days')::INTEGER,
      learning_steps = (v_answer.pre_state->>'learning_steps')::INTEGER,
      reps = (v_answer.pre_state->>'reps')::INTEGER,
      lapses = (v_answer.pre_state->>'lapses')::INTEGER,
      state = v_answer.pre_state->>'state',
      last_reviewed_at = (v_answer.pre_state->>'last_reviewed_at')::TIMESTAMPTZ,
      last_rating = v_answer.pre_state->>'last_rating',
      leech_at = (v_answer.pre_state->>'leech_at')::TIMESTAMPTZ,
      leech_lapses_notified = (v_answer.pre_state->>'leech_lapses_notified')::INTEGER,
      revision = v_revision,
      updated_at = NOW()
  WHERE id = v_state.id;

  UPDATE public.student_flashcard_review_logs
  SET undone_at = NOW()
  WHERE id = v_answer.id;

  UPDATE public.student_flashcard_review_states sibling
  SET buried_until = (prior->>'buried_until')::TIMESTAMPTZ,
      buried_reason = prior->>'buried_reason',
      revision = sibling.revision + 1,
      updated_at = NOW()
  FROM jsonb_array_elements(COALESCE(v_answer.result->'_siblingPre', '[]'::JSONB)) prior
  WHERE sibling.student_id = p_student_id
    AND sibling.review_card_id = (prior->>'review_card_id')::UUID;

  INSERT INTO public.student_flashcard_review_logs (
    student_id, review_card_id, request_id, request_fingerprint, action, answered_at,
    pre_revision, post_revision, pre_state, post_state, result, undoes_log_id, reset_generation
  ) VALUES (
    p_student_id, v_answer.review_card_id, p_request_id, p_request_fingerprint, 'undo', NOW(),
    v_state.revision, v_revision, v_answer.post_state, v_answer.pre_state,
    jsonb_build_object('undoneReviewLogId', v_answer.id), v_answer.id, v_answer.reset_generation
  );

  RETURN jsonb_build_object('undoneReviewLogId', v_answer.id, 'revision', v_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.undo_flashcard_answer(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_flashcard_answer(UUID, UUID, UUID, TEXT)
  TO service_role;

-- Supports study-day allowance reads without scanning all historical review
-- log rows. The partial predicate matches the due-snapshot query exactly.
CREATE INDEX student_flashcard_review_logs_active_answer_day
  ON public.student_flashcard_review_logs(student_id, answered_at)
  INCLUDE (pre_state)
  WHERE action = 'answer' AND undone_at IS NULL;
