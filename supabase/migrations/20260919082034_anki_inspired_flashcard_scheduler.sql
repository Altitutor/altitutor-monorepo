-- Anki-inspired flashcard scheduling primitives. Scheduling calculations stay in
-- the application; this migration owns durable policy, history and atomicity.

CREATE TABLE public.flashcard_study_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX flashcard_study_presets_one_default
  ON public.flashcard_study_presets (is_default) WHERE is_default;

CREATE TABLE public.flashcard_study_preset_versions (
  preset_id UUID NOT NULL REFERENCES public.flashcard_study_presets(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  desired_retention NUMERIC NOT NULL DEFAULT 0.90 CHECK (desired_retention BETWEEN 0.80 AND 0.95),
  learning_steps_minutes INTEGER[] NOT NULL DEFAULT ARRAY[1, 10],
  relearning_steps_minutes INTEGER[] NOT NULL DEFAULT ARRAY[10],
  minimum_lapse_interval_days INTEGER NOT NULL DEFAULT 1 CHECK (minimum_lapse_interval_days BETWEEN 1 AND 365),
  learn_ahead_minutes INTEGER NOT NULL DEFAULT 20 CHECK (learn_ahead_minutes BETWEEN 0 AND 1440),
  leech_threshold INTEGER NOT NULL DEFAULT 8 CHECK (leech_threshold > 0),
  leech_reminder_interval INTEGER NOT NULL DEFAULT 4 CHECK (leech_reminder_interval > 0),
  fsrs_parameters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  PRIMARY KEY (preset_id, version),
  CHECK (0 <= ALL(learning_steps_minutes)),
  CHECK (0 <= ALL(relearning_steps_minutes)),
  CHECK (jsonb_typeof(fsrs_parameters) = 'array')
);

CREATE TABLE public.subject_flashcard_study_presets (
  subject_id UUID PRIMARY KEY REFERENCES public.subjects(id) ON DELETE CASCADE,
  preset_id UUID NOT NULL REFERENCES public.flashcard_study_presets(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

CREATE TABLE public.student_flashcard_preferences (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  new_cards_per_study_day INTEGER NOT NULL DEFAULT 20 CHECK (new_cards_per_study_day BETWEEN 0 AND 9999),
  review_cards_per_study_day INTEGER NOT NULL DEFAULT 200 CHECK (review_cards_per_study_day BETWEEN 0 AND 9999),
  timezone TEXT NOT NULL DEFAULT 'Australia/Adelaide',
  timezone_confirmed_at TIMESTAMPTZ,
  pending_timezone TEXT,
  pending_timezone_effective_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.student_flashcard_preset_preferences (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  preset_id UUID NOT NULL REFERENCES public.flashcard_study_presets(id) ON DELETE CASCADE,
  desired_retention NUMERIC CHECK (desired_retention BETWEEN 0.80 AND 0.95),
  optimized_fsrs_parameters JSONB,
  optimizer_eligible_reviews INTEGER NOT NULL DEFAULT 0 CHECK (optimizer_eligible_reviews >= 0),
  optimized_at TIMESTAMPTZ,
  PRIMARY KEY (student_id, preset_id),
  CHECK (optimized_fsrs_parameters IS NULL OR jsonb_typeof(optimized_fsrs_parameters) = 'array')
);

INSERT INTO public.flashcard_study_presets(id, name, is_default)
VALUES ('f5000000-0000-4000-8000-000000000001', 'Default', TRUE);
INSERT INTO public.flashcard_study_preset_versions(preset_id, version, fsrs_parameters)
VALUES ('f5000000-0000-4000-8000-000000000001', 1,
  '[0.212,1.2931,2.3065,8.2956,6.4133,0.8334,3.0194,0.001,1.8722,0.1666,0.796,1.4835,0.0614,0.2629,1.6483,0.6014,1.8729,0.5425,0.0912,0.0658,0.1542]'::JSONB);

CREATE OR REPLACE FUNCTION public.prevent_flashcard_preset_version_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'flashcard_preset_versions_are_immutable' USING ERRCODE='55000'; END; $$;
CREATE TRIGGER prevent_flashcard_preset_version_mutation BEFORE UPDATE OR DELETE ON public.flashcard_study_preset_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_flashcard_preset_version_mutation();

ALTER TABLE public.student_flashcard_review_states
  ADD COLUMN revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  ADD COLUMN buried_until TIMESTAMPTZ,
  ADD COLUMN buried_reason TEXT CHECK (buried_reason IS NULL OR buried_reason IN ('manual', 'sibling')),
  ADD COLUMN suspended_at TIMESTAMPTZ,
  ADD COLUMN leech_at TIMESTAMPTZ,
  ADD COLUMN leech_lapses_notified INTEGER NOT NULL DEFAULT 0 CHECK (leech_lapses_notified >= 0),
  ADD COLUMN reset_generation INTEGER NOT NULL DEFAULT 0 CHECK (reset_generation >= 0);

-- The feature has not launched. Start the new scheduler from a clean mutable
-- state rather than manufacturing revlog entries for legacy prototype data.
DELETE FROM public.student_flashcard_review_states;

CREATE TABLE public.student_flashcard_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  review_card_id UUID NOT NULL REFERENCES public.flashcard_review_cards(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  request_fingerprint TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('answer', 'undo', 'forget', 'suspend', 'resume', 'bury', 'unbury')),
  rating TEXT CHECK (rating IS NULL OR rating IN ('again', 'hard', 'good', 'easy')),
  answered_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 60000),
  preset_id UUID REFERENCES public.flashcard_study_presets(id) ON DELETE RESTRICT,
  preset_version INTEGER,
  scheduler_version TEXT,
  pre_revision BIGINT NOT NULL,
  post_revision BIGINT NOT NULL,
  pre_state JSONB NOT NULL,
  post_state JSONB NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  reset_generation INTEGER NOT NULL DEFAULT 0,
  undone_at TIMESTAMPTZ,
  undoes_log_id UUID REFERENCES public.student_flashcard_review_logs(id) ON DELETE RESTRICT,
  UNIQUE (student_id, request_id)
);
CREATE INDEX student_flashcard_review_logs_history
  ON public.student_flashcard_review_logs(student_id, review_card_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.flashcard_review_state_json(
  p_state public.student_flashcard_review_states
) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$ SELECT to_jsonb(p_state) $$;

CREATE OR REPLACE FUNCTION public.flashcard_study_day_bounds(p_now TIMESTAMPTZ, p_timezone TEXT)
RETURNS TABLE(starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, study_day DATE)
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE v_local TIMESTAMP; v_day DATE;
BEGIN
  BEGIN v_local := p_now AT TIME ZONE p_timezone;
  EXCEPTION WHEN invalid_parameter_value THEN RAISE EXCEPTION 'invalid_flashcard_timezone' USING ERRCODE='22023'; END;
  v_day := v_local::DATE - CASE WHEN v_local::TIME < TIME '04:00' THEN 1 ELSE 0 END;
  RETURN QUERY SELECT (v_day + TIME '04:00') AT TIME ZONE p_timezone,
    (v_day + 1 + TIME '04:00') AT TIME ZONE p_timezone, v_day;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_flashcard_review_answer(
  p_student_id UUID,
  p_review_card_id UUID,
  p_request_id UUID,
  p_request_fingerprint TEXT,
  p_expected_revision BIGINT,
  p_answered_at TIMESTAMPTZ,
  p_duration_ms INTEGER,
  p_rating TEXT,
  p_preset_id UUID,
  p_preset_version INTEGER,
  p_scheduler_version TEXT,
  p_next_state JSONB,
  p_result JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_state public.student_flashcard_review_states;
  v_existing public.student_flashcard_review_logs;
  v_pre JSONB;
  v_log_id UUID;
  v_flashcard_id UUID;
  v_lapse BOOLEAN;
  v_sibling_pre JSONB;
  v_leech_suggest BOOLEAN;
  v_timezone TEXT;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_new_limit INTEGER;
  v_review_limit INTEGER;
  v_new_used INTEGER;
  v_review_used INTEGER;
BEGIN
  IF p_rating NOT IN ('again', 'hard', 'good', 'easy') THEN RAISE EXCEPTION 'invalid_flashcard_rating' USING ERRCODE = '22023'; END IF;
  IF p_duration_ms < 0 THEN RAISE EXCEPTION 'invalid_flashcard_duration' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_existing FROM public.student_flashcard_review_logs
    WHERE student_id = p_student_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'flashcard_idempotency_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.result || jsonb_build_object('reviewLogId', v_existing.id, 'replayed', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id::TEXT, 7319));
  SELECT * INTO v_existing FROM public.student_flashcard_review_logs
    WHERE student_id = p_student_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> p_request_fingerprint THEN RAISE EXCEPTION 'flashcard_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_existing.result || jsonb_build_object('reviewLogId',v_existing.id,'replayed',true);
  END IF;

  INSERT INTO public.student_flashcard_review_states(student_id, review_card_id)
    VALUES (p_student_id, p_review_card_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_state FROM public.student_flashcard_review_states
    WHERE student_id = p_student_id AND review_card_id = p_review_card_id FOR UPDATE;
  IF v_state.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'flashcard_stale_revision' USING ERRCODE = '40001';
  END IF;
  IF v_state.suspended_at IS NOT NULL THEN RAISE EXCEPTION 'flashcard_suspended' USING ERRCODE='P0001'; END IF;
  IF v_state.buried_until IS NOT NULL AND v_state.buried_until>p_answered_at THEN RAISE EXCEPTION 'flashcard_buried' USING ERRCODE='P0001'; END IF;
  IF v_state.state='Review' AND v_state.due_at>p_answered_at THEN RAISE EXCEPTION 'flashcard_not_due' USING ERRCODE='P0001'; END IF;
  IF v_state.state IN ('Learning','Relearning') AND v_state.due_at>p_answered_at+make_interval(mins=>COALESCE((p_result->>'learnAheadMinutes')::INTEGER,20)) THEN RAISE EXCEPTION 'flashcard_not_due' USING ERRCODE='P0001'; END IF;
  SELECT COALESCE(timezone,'Australia/Adelaide'),COALESCE(new_cards_per_study_day,20),COALESCE(review_cards_per_study_day,200)
    INTO v_timezone,v_new_limit,v_review_limit FROM public.student_flashcard_preferences WHERE student_id=p_student_id;
  v_timezone:=COALESCE(v_timezone,'Australia/Adelaide');v_new_limit:=COALESCE(v_new_limit,20);v_review_limit:=COALESCE(v_review_limit,200);
  SELECT starts_at,ends_at INTO v_day_start,v_day_end FROM public.flashcard_study_day_bounds(p_answered_at,v_timezone);
  SELECT count(*) FILTER(WHERE pre_state->>'state'='New'),count(*) FILTER(WHERE pre_state->>'state'='Review')
    INTO v_new_used,v_review_used FROM public.student_flashcard_review_logs
    WHERE student_id=p_student_id AND action='answer' AND undone_at IS NULL AND answered_at>=v_day_start AND answered_at<v_day_end;
  IF v_state.state='New' AND v_new_limit<>9999 AND v_new_used>=v_new_limit THEN RAISE EXCEPTION 'flashcard_new_limit_reached' USING ERRCODE='P0001'; END IF;
  IF v_state.state='Review' AND v_review_limit<>9999 AND v_review_used>=v_review_limit THEN RAISE EXCEPTION 'flashcard_review_limit_reached' USING ERRCODE='P0001'; END IF;
  IF v_state.state='New' AND v_review_limit<>9999 AND v_review_used>=v_review_limit AND EXISTS(
    SELECT 1 FROM public.student_flashcard_review_states held WHERE held.student_id=p_student_id AND held.state='Review'
      AND held.due_at<=p_answered_at AND held.suspended_at IS NULL AND (held.buried_until IS NULL OR held.buried_until<=p_answered_at)
  ) THEN RAISE EXCEPTION 'flashcard_new_blocked_by_reviews' USING ERRCODE='P0001'; END IF;
  SELECT flashcard_id INTO v_flashcard_id FROM public.flashcard_review_cards WHERE id = p_review_card_id AND deleted_at IS NULL;
  IF v_flashcard_id IS NULL THEN RAISE EXCEPTION 'flashcard_review_card_not_found' USING ERRCODE = '22023'; END IF;

  v_pre := public.flashcard_review_state_json(v_state);
  v_lapse := v_state.state = 'Review' AND p_rating = 'again';
  v_leech_suggest := v_lapse AND (p_next_state->>'lapses')::INTEGER >= COALESCE((p_result->>'leechThreshold')::INTEGER,8)
    AND (v_state.leech_lapses_notified = 0 OR (p_next_state->>'lapses')::INTEGER >= v_state.leech_lapses_notified + COALESCE((p_result->>'leechReminderInterval')::INTEGER,4));

  INSERT INTO public.student_flashcard_review_states(student_id, review_card_id)
  SELECT p_student_id, rc.id FROM public.flashcard_review_cards rc
  WHERE rc.flashcard_id = v_flashcard_id AND rc.id <> p_review_card_id AND rc.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  SELECT COALESCE(jsonb_agg(public.flashcard_review_state_json(s) ORDER BY s.review_card_id), '[]'::JSONB)
    INTO v_sibling_pre
  FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id
  WHERE s.student_id=p_student_id AND rc.flashcard_id=v_flashcard_id AND rc.id<>p_review_card_id AND s.suspended_at IS NULL;
  UPDATE public.student_flashcard_review_states SET
    due_at = (p_next_state->>'due_at')::TIMESTAMPTZ,
    stability = (p_next_state->>'stability')::NUMERIC,
    difficulty = (p_next_state->>'difficulty')::NUMERIC,
    scheduled_days = (p_next_state->>'scheduled_days')::INTEGER,
    learning_steps = (p_next_state->>'learning_steps')::INTEGER,
    reps = (p_next_state->>'reps')::INTEGER,
    lapses = (p_next_state->>'lapses')::INTEGER,
    state = p_next_state->>'state',
    last_reviewed_at = p_answered_at,
    last_rating = p_rating,
    revision = revision + 1,
    leech_at = CASE WHEN v_lapse AND (p_next_state->>'lapses')::INTEGER >= COALESCE((p_result->>'leechThreshold')::INTEGER,8) THEN COALESCE(leech_at, p_answered_at) ELSE leech_at END,
    leech_lapses_notified = CASE WHEN v_leech_suggest THEN (p_next_state->>'lapses')::INTEGER ELSE leech_lapses_notified END,
    updated_at = NOW()
  WHERE id = v_state.id RETURNING * INTO v_state;

  UPDATE public.student_flashcard_review_states sibling SET
    buried_until = COALESCE((p_result->>'studyDayEndsAt')::TIMESTAMPTZ, p_answered_at + INTERVAL '1 day'),
    buried_reason = 'sibling', revision = revision + 1, updated_at = NOW()
  FROM public.flashcard_review_cards rc
  WHERE sibling.student_id = p_student_id AND sibling.review_card_id = rc.id
    AND rc.flashcard_id = v_flashcard_id AND rc.id <> p_review_card_id
    AND sibling.suspended_at IS NULL;

  INSERT INTO public.student_flashcard_review_logs(
    student_id, review_card_id, request_id, request_fingerprint, action, rating,
    answered_at, duration_ms, preset_id, preset_version, scheduler_version,
    pre_revision, post_revision, pre_state, post_state, result, reset_generation
  ) VALUES (
    p_student_id, p_review_card_id, p_request_id, p_request_fingerprint, 'answer', p_rating,
    p_answered_at, LEAST(p_duration_ms, 60000), p_preset_id, p_preset_version, p_scheduler_version,
    p_expected_revision, v_state.revision, v_pre, public.flashcard_review_state_json(v_state),
    p_result || jsonb_build_object('_siblingPre', v_sibling_pre, 'leechSuggested',v_leech_suggest), v_state.reset_generation
  ) RETURNING id INTO v_log_id;
  RETURN p_result || jsonb_build_object('reviewLogId', v_log_id, 'revision', v_state.revision, 'replayed', false, 'leechSuggested',v_leech_suggest);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_latest_flashcard_answer(
  p_student_id UUID, p_request_id UUID, p_request_fingerprint TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_answer public.student_flashcard_review_logs; v_existing public.student_flashcard_review_logs; v_state public.student_flashcard_review_states; v_revision BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id::TEXT,7319));
  SELECT * INTO v_existing FROM public.student_flashcard_review_logs WHERE student_id=p_student_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>p_request_fingerprint THEN RAISE EXCEPTION 'flashcard_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_existing.result || jsonb_build_object('replayed',true,'reviewLogId',v_existing.id);
  END IF;
  SELECT * INTO v_answer FROM public.student_flashcard_review_logs
    WHERE student_id=p_student_id AND action='answer' AND undone_at IS NULL
    ORDER BY recorded_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_flashcard_answer_to_undo' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_state FROM public.student_flashcard_review_states
    WHERE student_id=p_student_id AND review_card_id=v_answer.review_card_id FOR UPDATE;
  IF v_state.revision <> v_answer.post_revision THEN RAISE EXCEPTION 'flashcard_undo_conflict' USING ERRCODE='40001'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_answer.result->'_siblingPre','[]'::JSONB)) prior
    JOIN public.student_flashcard_review_states sibling ON sibling.student_id=p_student_id AND sibling.review_card_id=(prior->>'review_card_id')::UUID
    WHERE sibling.revision<>(prior->>'revision')::BIGINT+1
  ) THEN RAISE EXCEPTION 'flashcard_undo_conflict' USING ERRCODE='40001'; END IF;
  v_revision := v_state.revision + 1;
  UPDATE public.student_flashcard_review_states SET
    due_at=(v_answer.pre_state->>'due_at')::TIMESTAMPTZ, stability=(v_answer.pre_state->>'stability')::NUMERIC,
    difficulty=(v_answer.pre_state->>'difficulty')::NUMERIC, scheduled_days=(v_answer.pre_state->>'scheduled_days')::INTEGER,
    learning_steps=(v_answer.pre_state->>'learning_steps')::INTEGER, reps=(v_answer.pre_state->>'reps')::INTEGER,
    lapses=(v_answer.pre_state->>'lapses')::INTEGER, state=v_answer.pre_state->>'state',
    last_reviewed_at=(v_answer.pre_state->>'last_reviewed_at')::TIMESTAMPTZ, last_rating=v_answer.pre_state->>'last_rating',
    leech_at=(v_answer.pre_state->>'leech_at')::TIMESTAMPTZ,
    leech_lapses_notified=(v_answer.pre_state->>'leech_lapses_notified')::INTEGER,
    revision=v_revision, updated_at=NOW()
  WHERE id=v_state.id;
  UPDATE public.student_flashcard_review_logs SET undone_at=NOW() WHERE id=v_answer.id;
  UPDATE public.student_flashcard_review_states s SET
    buried_until=(prior->>'buried_until')::TIMESTAMPTZ,
    buried_reason=prior->>'buried_reason', revision=s.revision+1, updated_at=NOW()
  FROM jsonb_array_elements(COALESCE(v_answer.result->'_siblingPre','[]'::JSONB)) prior
  WHERE s.student_id=p_student_id AND s.review_card_id=(prior->>'review_card_id')::UUID;
  INSERT INTO public.student_flashcard_review_logs(student_id,review_card_id,request_id,request_fingerprint,action,answered_at,
    pre_revision,post_revision,pre_state,post_state,result,undoes_log_id,reset_generation)
  VALUES(p_student_id,v_answer.review_card_id,p_request_id,p_request_fingerprint,'undo',NOW(),v_state.revision,v_revision,
    v_answer.post_state,v_answer.pre_state,jsonb_build_object('undoneReviewLogId',v_answer.id),v_answer.id,v_answer.reset_generation);
  RETURN jsonb_build_object('undoneReviewLogId',v_answer.id,'revision',v_revision);
END; $$;

CREATE OR REPLACE FUNCTION public.manage_flashcard_review_card(
  p_student_id UUID, p_review_card_id UUID, p_request_id UUID, p_request_fingerprint TEXT,
  p_action TEXT, p_now TIMESTAMPTZ, p_buried_until TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_state public.student_flashcard_review_states; v_existing public.student_flashcard_review_logs;
  v_pre JSONB; v_log_id UUID;
BEGIN
  IF p_action NOT IN ('forget','suspend','resume','bury','unbury') THEN
    RAISE EXCEPTION 'invalid_flashcard_management_action' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id::TEXT,7319));
  SELECT * INTO v_existing FROM public.student_flashcard_review_logs WHERE student_id=p_student_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>p_request_fingerprint THEN RAISE EXCEPTION 'flashcard_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_existing.result || jsonb_build_object('replayed',true,'reviewLogId',v_existing.id);
  END IF;
  INSERT INTO public.student_flashcard_review_states(student_id,review_card_id) VALUES(p_student_id,p_review_card_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_state FROM public.student_flashcard_review_states WHERE student_id=p_student_id AND review_card_id=p_review_card_id FOR UPDATE;
  v_pre:=public.flashcard_review_state_json(v_state);
  UPDATE public.student_flashcard_review_states SET
    due_at=CASE WHEN p_action='forget' THEN p_now ELSE due_at END,
    stability=CASE WHEN p_action='forget' THEN NULL ELSE stability END,
    difficulty=CASE WHEN p_action='forget' THEN NULL ELSE difficulty END,
    scheduled_days=CASE WHEN p_action='forget' THEN 0 ELSE scheduled_days END,
    learning_steps=CASE WHEN p_action='forget' THEN 0 ELSE learning_steps END,
    reps=CASE WHEN p_action='forget' THEN 0 ELSE reps END,
    lapses=CASE WHEN p_action='forget' THEN 0 ELSE lapses END,
    state=CASE WHEN p_action='forget' THEN 'New' ELSE state END,
    last_reviewed_at=CASE WHEN p_action='forget' THEN NULL ELSE last_reviewed_at END,
    last_rating=CASE WHEN p_action='forget' THEN NULL ELSE last_rating END,
    buried_until=CASE WHEN p_action='bury' THEN p_buried_until WHEN p_action IN ('unbury','forget') THEN NULL ELSE buried_until END,
    buried_reason=CASE WHEN p_action='bury' THEN 'manual' WHEN p_action IN ('unbury','forget') THEN NULL ELSE buried_reason END,
    suspended_at=CASE WHEN p_action='suspend' THEN p_now WHEN p_action IN ('resume','forget') THEN NULL ELSE suspended_at END,
    leech_at=CASE WHEN p_action='forget' THEN NULL ELSE leech_at END,
    leech_lapses_notified=CASE WHEN p_action='forget' THEN 0 ELSE leech_lapses_notified END,
    reset_generation=reset_generation+CASE WHEN p_action='forget' THEN 1 ELSE 0 END,
    revision=revision+1,updated_at=NOW()
  WHERE id=v_state.id RETURNING * INTO v_state;
  INSERT INTO public.student_flashcard_review_logs(student_id,review_card_id,request_id,request_fingerprint,action,answered_at,
    pre_revision,post_revision,pre_state,post_state,result,reset_generation)
  VALUES(p_student_id,p_review_card_id,p_request_id,p_request_fingerprint,p_action,p_now,
    (v_pre->>'revision')::BIGINT,v_state.revision,v_pre,public.flashcard_review_state_json(v_state),
    jsonb_build_object('revision',v_state.revision),v_state.reset_generation) RETURNING id INTO v_log_id;
  RETURN jsonb_build_object('revision',v_state.revision,'reviewLogId',v_log_id,'replayed',false);
END; $$;

CREATE OR REPLACE FUNCTION public.flashcard_optimizer_candidates(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE(student_id UUID,preset_id UUID,eligible_reviews BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT l.student_id,l.preset_id,count(*)
  FROM public.student_flashcard_review_logs l
  JOIN public.flashcard_review_cards rc ON rc.id=l.review_card_id AND rc.deleted_at IS NULL
  JOIN public.student_flashcard_review_states s ON s.student_id=l.student_id AND s.review_card_id=l.review_card_id AND s.reset_generation=l.reset_generation
  LEFT JOIN public.student_flashcard_preset_preferences p ON p.student_id=l.student_id AND p.preset_id=l.preset_id
  WHERE l.action='answer' AND l.undone_at IS NULL AND l.preset_id IS NOT NULL
    AND (p.optimized_at IS NULL OR p.optimized_at < p_now-INTERVAL '7 days')
  GROUP BY l.student_id,l.preset_id HAVING count(*)>=1000
$$;

CREATE OR REPLACE FUNCTION public.reset_reintroduced_flashcard_review_card()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.student_flashcard_review_states SET due_at=NOW(),stability=NULL,difficulty=NULL,scheduled_days=0,
      learning_steps=0,reps=0,lapses=0,state='New',last_reviewed_at=NULL,last_rating=NULL,buried_until=NULL,
      buried_reason=NULL,suspended_at=NULL,leech_at=NULL,leech_lapses_notified=0,reset_generation=reset_generation+1,
      revision=revision+1,updated_at=NOW() WHERE review_card_id=NEW.id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER reset_reintroduced_flashcard_review_card
AFTER UPDATE OF deleted_at ON public.flashcard_review_cards FOR EACH ROW
EXECUTE FUNCTION public.reset_reintroduced_flashcard_review_card();

-- Base tables are service/AdminStaff only. Students use scoped views and API commands.
ALTER TABLE public.flashcard_study_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_study_preset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_flashcard_study_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_flashcard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_flashcard_preset_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_flashcard_review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ADMINSTAFF manages flashcard presets" ON public.flashcard_study_presets FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF manages flashcard preset versions" ON public.flashcard_study_preset_versions FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF manages subject flashcard presets" ON public.subject_flashcard_study_presets FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF manages flashcard preferences" ON public.student_flashcard_preferences FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF manages preset preferences" ON public.student_flashcard_preset_preferences FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF reads flashcard history" ON public.student_flashcard_review_logs FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
REVOKE ALL ON TABLE public.flashcard_study_presets, public.flashcard_study_preset_versions,
  public.subject_flashcard_study_presets, public.student_flashcard_preferences,
  public.student_flashcard_preset_preferences, public.student_flashcard_review_logs
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.flashcard_study_presets,
  public.flashcard_study_preset_versions, public.subject_flashcard_study_presets,
  public.student_flashcard_preferences, public.student_flashcard_preset_preferences
  TO authenticated;
GRANT SELECT ON TABLE public.student_flashcard_review_logs TO authenticated;
GRANT ALL ON TABLE public.flashcard_study_presets, public.flashcard_study_preset_versions,
  public.subject_flashcard_study_presets, public.student_flashcard_preferences,
  public.student_flashcard_preset_preferences, public.student_flashcard_review_logs
  TO service_role;
REVOKE ALL ON FUNCTION public.flashcard_review_state_json(public.student_flashcard_review_states) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flashcard_study_day_bounds(TIMESTAMPTZ,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_flashcard_preset_version_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_reintroduced_flashcard_review_card() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_flashcard_review_answer(UUID,UUID,UUID,TEXT,BIGINT,TIMESTAMPTZ,INTEGER,TEXT,UUID,INTEGER,TEXT,JSONB,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.undo_latest_flashcard_answer(UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manage_flashcard_review_card(UUID,UUID,UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flashcard_optimizer_candidates(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_flashcard_review_answer(UUID,UUID,UUID,TEXT,BIGINT,TIMESTAMPTZ,INTEGER,TEXT,UUID,INTEGER,TEXT,JSONB,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_latest_flashcard_answer(UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.manage_flashcard_review_card(UUID,UUID,UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.flashcard_optimizer_candidates(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.flashcard_study_day_bounds(TIMESTAMPTZ,TEXT) TO service_role;

CREATE OR REPLACE VIEW public.vstudent_flashcard_review_cards
WITH (security_invoker = false) AS
SELECT rc.id, rc.flashcard_id, rc.cloze_index, f.topic_id, f.card_type, f.cloze_text, f.extra,
  f.image_file_id, f.image_alt_text, f.occlusion_data, image_file.storage_path AS image_storage_path,
  image_file.mimetype AS image_mimetype, f.index AS flashcard_index,
  COALESCE(s.due_at, NOW()) AS due_at, s.stability, s.difficulty,
  COALESCE(s.scheduled_days,0) AS scheduled_days, COALESCE(s.learning_steps,0) AS learning_steps,
  COALESCE(s.reps,0) AS reps, COALESCE(s.lapses,0) AS lapses, COALESCE(s.state,'New') AS state,
  s.last_reviewed_at, s.last_rating, COALESCE(s.revision,0) AS revision,
  CASE WHEN s.buried_until>NOW() THEN s.buried_until END AS buried_until,
  CASE WHEN s.buried_until>NOW() THEN s.buried_reason END AS buried_reason, s.suspended_at, s.leech_at
FROM public.flashcard_review_cards rc
JOIN public.flashcards f ON f.id=rc.flashcard_id
JOIN public.topics t ON t.id=f.topic_id
LEFT JOIN public.files image_file ON image_file.id=f.image_file_id
LEFT JOIN public.student_flashcard_review_states s ON s.review_card_id=rc.id AND s.student_id=public.current_student_id()
WHERE rc.deleted_at IS NULL AND f.deleted_at IS NULL
  AND t.subject_id IN (SELECT access.subject_id FROM public.vstudent_my_subject_access access WHERE access.subject_id IS NOT NULL);
GRANT SELECT ON public.vstudent_flashcard_review_cards TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_flashcard_review_history
WITH (security_invoker=false) AS
SELECT l.id,l.student_id,l.review_card_id,l.action,l.rating,l.answered_at,l.duration_ms,
  l.pre_state,l.post_state,l.undone_at,f.topic_id,t.subject_id
FROM public.student_flashcard_review_logs l
JOIN public.flashcard_review_cards rc ON rc.id=l.review_card_id
JOIN public.flashcards f ON f.id=rc.flashcard_id
JOIN public.topics t ON t.id=f.topic_id
WHERE EXISTS (
  SELECT 1 FROM public.classes_students cs
  JOIN public.classes_staff cstaff ON cstaff.class_id=cs.class_id AND cstaff.unassigned_at IS NULL
  JOIN public.classes c ON c.id=cs.class_id
  WHERE cs.student_id=l.student_id AND cs.unenrolled_at IS NULL
    AND cstaff.staff_id=public.current_tutor_id() AND c.subject_id=t.subject_id
);
GRANT SELECT ON public.vtutor_flashcard_review_history TO authenticated;
