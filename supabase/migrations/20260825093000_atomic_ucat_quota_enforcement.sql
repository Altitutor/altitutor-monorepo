-- Make quota decisions and the writes which consume quota share one database
-- transaction. Application preflight checks remain useful for UX, but cannot
-- be authoritative when concurrent requests race.

CREATE OR REPLACE FUNCTION public.ucat_quota_rejection_for_start(
  p_student_id uuid,
  p_area text,
  p_resource_id uuid,
  p_consumption_already_written boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_timezone text;
  v_limit integer;
  v_period text;
  v_period_start timestamptz;
  v_reset_start timestamptz;
  v_count_start timestamptz;
  v_used integer := 0;
  v_resource_type text;
BEGIN
  IF p_area NOT IN ('practice', 'sets', 'mocks', 'learn') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ucat_quota_area';
  END IF;

  -- Serialise quota consumers for one student without creating a global lock.
  SELECT coalesce(nullif(student.timezone, ''), 'Australia/Adelaide')
  INTO v_timezone
  FROM public.students student
  WHERE student.id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'student_not_found';
  END IF;

  v_resource_type := CASE p_area
    WHEN 'practice' THEN 'question'
    WHEN 'sets' THEN 'question_set'
    WHEN 'mocks' THEN 'mock'
    WHEN 'learn' THEN 'learning_module'
  END;

  IF public.is_ucat_online_quota_exempt(p_student_id)
    OR public.student_has_in_person_ucat_session_resource(
      p_student_id, v_resource_type, p_resource_id
    )
  THEN
    RETURN NULL;
  END IF;

  SELECT
    CASE p_area
      WHEN 'practice' THEN config.free_practice_limit
      WHEN 'sets' THEN config.free_sets_limit
      WHEN 'mocks' THEN config.free_mocks_limit
      WHEN 'learn' THEN config.free_learn_limit
    END,
    CASE p_area
      WHEN 'practice' THEN config.free_practice_period
      WHEN 'sets' THEN config.free_sets_period
      WHEN 'mocks' THEN config.free_mocks_period
      WHEN 'learn' THEN config.free_learn_period
    END
  INTO v_limit, v_period
  FROM public.ucat_subscription_config config
  ORDER BY config.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_config_not_found';
  END IF;

  v_period_start := CASE v_period
    WHEN 'day' THEN date_trunc('day', v_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone
    WHEN 'week' THEN date_trunc('week', v_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone
    WHEN 'month' THEN date_trunc('month', v_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone
  END;
  IF v_period_start IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_quota_period';
  END IF;

  v_reset_start := public.get_ucat_free_quota_reset_boundary(p_student_id, p_area);
  v_count_start := greatest(v_period_start, coalesce(v_reset_start, v_period_start));

  -- Reopening the same already-counted resource never consumes quota twice.
  IF NOT p_consumption_already_written AND p_area = 'practice' AND EXISTS (
    SELECT 1 FROM public.student_question_attempts attempt
    WHERE attempt.student_id = p_student_id
      AND attempt.question_id = p_resource_id
      AND attempt.student_practice_session_id IS NOT NULL
      AND attempt.student_question_set_attempt_id IS NULL
      AND attempt.first_seen_at >= v_count_start
  ) THEN RETURN NULL;
  ELSIF NOT p_consumption_already_written AND p_area = 'learn' AND EXISTS (
    SELECT 1 FROM public.ucat_student_learning_module_progress progress
    WHERE progress.student_id = p_student_id
      AND progress.learning_module_id = p_resource_id
  ) THEN RETURN NULL;
  END IF;

  IF v_limit > 0 THEN
    IF p_area = 'practice' THEN
      SELECT count(DISTINCT attempt.question_id)::integer INTO v_used
      FROM public.student_question_attempts attempt
      WHERE attempt.student_id = p_student_id
        AND attempt.student_practice_session_id IS NOT NULL
        AND attempt.student_question_set_attempt_id IS NULL
        AND attempt.first_seen_at >= v_count_start
        AND NOT public.student_has_in_person_ucat_session_resource(
          p_student_id, 'question', attempt.question_id
        );
    ELSIF p_area = 'sets' THEN
      SELECT count(*)::integer INTO v_used
      FROM public.student_question_set_attempts attempt
      WHERE attempt.student_id = p_student_id
        AND attempt.student_ucat_mock_attempt_id IS NULL
        AND attempt.attempted_at >= v_count_start
        AND NOT public.student_has_in_person_ucat_session_resource(
          p_student_id, 'question_set', attempt.question_set_id
        );
    ELSIF p_area = 'mocks' THEN
      SELECT count(*)::integer INTO v_used
      FROM public.student_ucat_mock_attempts attempt
      WHERE attempt.student_id = p_student_id
        AND attempt.attempted_at >= v_count_start
        AND NOT public.student_has_in_person_ucat_session_resource(
          p_student_id, 'mock', attempt.ucat_mock_id
        );
    ELSE
      SELECT count(*)::integer INTO v_used
      FROM public.ucat_student_learning_module_progress progress
      JOIN public.ucat_learning_modules module
        ON module.id = progress.learning_module_id AND module.kind = 'lesson'
      WHERE progress.student_id = p_student_id
        AND progress.started_at >= v_count_start
        AND NOT public.student_has_in_person_ucat_session_resource(
          p_student_id, 'learning_module', progress.learning_module_id
        );
    END IF;
  END IF;

  IF v_limit = 0
    OR (p_consumption_already_written AND v_used > v_limit)
    OR (NOT p_consumption_already_written AND v_used >= v_limit)
  THEN
    RETURN jsonb_build_object(
      'code', 'QUOTA_EXCEEDED',
      'area', p_area,
      'used', v_used,
      'limit', v_limit,
      'period', v_period
    );
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_quota_rejection_for_start(uuid, text, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ucat_quota_rejection_for_start(uuid, text, uuid, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_ucat_practice_attempt_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_rejection jsonb;
BEGIN
  IF NEW.student_practice_session_id IS NULL
    OR NEW.student_question_set_attempt_id IS NOT NULL
    OR NEW.first_seen_at IS NULL
    OR (TG_OP = 'UPDATE' AND OLD.first_seen_at IS NOT NULL)
  THEN
    RETURN NEW;
  END IF;
  v_rejection := public.ucat_quota_rejection_for_start(
    NEW.student_id, 'practice', NEW.question_id, true
  );
  IF v_rejection IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUOTA_EXCEEDED:' || v_rejection::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ucat_practice_attempt_quota
  ON public.student_question_attempts;
CREATE TRIGGER enforce_ucat_practice_attempt_quota
AFTER INSERT OR UPDATE OF first_seen_at ON public.student_question_attempts
FOR EACH ROW EXECUTE FUNCTION public.enforce_ucat_practice_attempt_quota();

CREATE OR REPLACE FUNCTION public.start_ucat_learning_module(
  p_student_id uuid,
  p_learning_module_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_rejection jsonb; v_id uuid; v_created boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_learning_modules module
    WHERE module.id = p_learning_module_id
      AND module.kind = 'lesson' AND module.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  v_rejection := public.ucat_quota_rejection_for_start(
    p_student_id, 'learn', p_learning_module_id
  );
  IF v_rejection IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'quota_exceeded', 'quota', v_rejection);
  END IF;
  INSERT INTO public.ucat_student_learning_module_progress (
    student_id, learning_module_id, completion_percent
  ) VALUES (p_student_id, p_learning_module_id, 0)
  ON CONFLICT (student_id, learning_module_id) DO NOTHING
  RETURNING id INTO v_id;
  v_created := v_id IS NOT NULL;
  RETURN jsonb_build_object('status', 'started', 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.start_ucat_learning_module(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_ucat_learning_module(uuid, uuid)
  TO service_role;

-- Fold the authoritative check into the existing atomic exam insert RPC.
CREATE OR REPLACE FUNCTION public.create_ucat_exam_attempt_records(
  p_attempt_kind text,
  p_student_id uuid,
  p_attempt_id uuid,
  p_resource_id uuid,
  p_engine_snapshot jsonb,
  p_current_segment_ends_at timestamptz,
  p_was_timed boolean,
  p_first_set_id uuid DEFAULT NULL,
  p_first_set_attempt_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_rejection jsonb;
BEGIN
  IF p_attempt_kind NOT IN ('set', 'mock') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid exam attempt kind';
  END IF;
  v_rejection := public.ucat_quota_rejection_for_start(
    p_student_id,
    CASE p_attempt_kind WHEN 'set' THEN 'sets' ELSE 'mocks' END,
    p_resource_id
  );
  IF v_rejection IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUOTA_EXCEEDED:' || v_rejection::text;
  END IF;

  IF p_attempt_kind = 'set' THEN
    INSERT INTO public.student_question_set_attempts (
      id, student_id, question_set_id, was_timed, engine_snapshot,
      current_segment_ends_at, last_activity_at
    ) VALUES (
      p_attempt_id, p_student_id, p_resource_id, p_was_timed,
      p_engine_snapshot, p_current_segment_ends_at, now()
    );
  ELSE
    INSERT INTO public.student_ucat_mock_attempts (
      id, student_id, ucat_mock_id, engine_snapshot,
      current_segment_ends_at, last_activity_at, was_timed
    ) VALUES (
      p_attempt_id, p_student_id, p_resource_id, p_engine_snapshot,
      p_current_segment_ends_at, now(), p_was_timed
    );
    IF p_first_set_id IS NOT NULL AND p_first_set_attempt_id IS NOT NULL THEN
      INSERT INTO public.student_question_set_attempts (
        id, student_id, question_set_id, student_ucat_mock_attempt_id, was_timed
      ) VALUES (
        p_first_set_attempt_id, p_student_id, p_first_set_id, p_attempt_id,
        p_was_timed
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ucat_exam_attempt_records(
  text, uuid, uuid, uuid, jsonb, timestamptz, boolean, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ucat_exam_attempt_records(
  text, uuid, uuid, uuid, jsonb, timestamptz, boolean, uuid, uuid
) TO service_role;
