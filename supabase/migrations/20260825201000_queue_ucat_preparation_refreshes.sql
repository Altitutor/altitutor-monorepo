-- Activity writes enqueue one coalesced refresh per Student. Page reads never
-- calculate score projection or reconcile Study-plan tasks.

CREATE TABLE public.ucat_student_preparation_refresh_requests (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dead_lettered_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ucat_student_preparation_refresh_pending_idx
  ON public.ucat_student_preparation_refresh_requests (next_attempt_at, requested_at)
  WHERE processing_started_at IS NULL AND dead_lettered_at IS NULL;

ALTER TABLE public.ucat_student_preparation_refresh_requests
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_student_preparation_refresh_requests
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ucat_student_preparation_refresh_requests TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_ucat_preparation_refresh(
  p_student_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.ucat_student_preparation_refresh_requests (
    student_id,
    requested_at,
    requested_reasons,
    next_attempt_at,
    updated_at
  )
  VALUES (
    p_student_id,
    clock_timestamp(),
    ARRAY[p_reason],
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (student_id) DO UPDATE
  SET
    requested_at = excluded.requested_at,
    next_attempt_at = CASE
      WHEN p_reason <> 'scheduled_rebalance' THEN excluded.next_attempt_at
      WHEN public.ucat_student_preparation_refresh_requests.requested_at
        <= coalesce(
          public.ucat_student_preparation_refresh_requests.completed_at,
          '-infinity'::TIMESTAMPTZ
        )
        THEN excluded.next_attempt_at
      ELSE public.ucat_student_preparation_refresh_requests.next_attempt_at
    END,
    dead_lettered_at = CASE
      WHEN p_reason <> 'scheduled_rebalance' THEN NULL
      ELSE public.ucat_student_preparation_refresh_requests.dead_lettered_at
    END,
    attempt_count = CASE
      WHEN p_reason <> 'scheduled_rebalance' THEN 0
      WHEN public.ucat_student_preparation_refresh_requests.requested_at
        <= coalesce(
          public.ucat_student_preparation_refresh_requests.completed_at,
          '-infinity'::TIMESTAMPTZ
        )
        THEN 0
      ELSE public.ucat_student_preparation_refresh_requests.attempt_count
    END,
    requested_reasons = ARRAY(
      SELECT DISTINCT reason
      FROM unnest(
        public.ucat_student_preparation_refresh_requests.requested_reasons
          || excluded.requested_reasons
      ) reason
      ORDER BY reason
    ),
    updated_at = clock_timestamp();
$$;

REVOKE ALL ON FUNCTION public.enqueue_ucat_preparation_refresh(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_ucat_preparation_refresh(UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ucat_preparation_refreshes(
  p_limit INTEGER DEFAULT 10,
  p_student_id UUID DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  requested_reasons TEXT[]
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT request.student_id
    FROM public.ucat_student_preparation_refresh_requests request
    WHERE (p_student_id IS NULL OR request.student_id = p_student_id)
      AND request.requested_at > coalesce(
        request.completed_at,
        '-infinity'::TIMESTAMPTZ
      )
      AND request.dead_lettered_at IS NULL
      AND request.next_attempt_at <= clock_timestamp()
      AND (
        request.processing_started_at IS NULL
        OR request.processing_started_at < clock_timestamp() - interval '10 minutes'
      )
    ORDER BY request.requested_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
  )
  UPDATE public.ucat_student_preparation_refresh_requests request
  SET
    processing_started_at = clock_timestamp(),
    attempt_count = request.attempt_count + 1,
    last_error = NULL,
    updated_at = clock_timestamp()
  FROM candidates
  WHERE request.student_id = candidates.student_id
  RETURNING request.student_id, request.requested_reasons;
$$;

REVOKE ALL ON FUNCTION public.claim_ucat_preparation_refreshes(INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ucat_preparation_refreshes(INTEGER, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.complete_ucat_preparation_refresh(
  p_student_id UUID,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.ucat_student_preparation_refresh_requests request
  SET
    processing_started_at = NULL,
    completed_at = CASE
      WHEN p_error IS NULL THEN request.processing_started_at
      ELSE request.completed_at
    END,
    requested_reasons = CASE
      WHEN p_error IS NULL
        AND request.requested_at <= request.processing_started_at
        THEN '{}'::TEXT[]
      ELSE request.requested_reasons
    END,
    attempt_count = CASE WHEN p_error IS NULL THEN 0 ELSE request.attempt_count END,
    next_attempt_at = CASE
      WHEN p_error IS NULL THEN clock_timestamp()
      ELSE clock_timestamp() + make_interval(
        secs => least(3600, 60 * power(2, greatest(request.attempt_count - 1, 0)))::INTEGER
      )
    END,
    dead_lettered_at = CASE
      WHEN p_error IS NOT NULL AND request.attempt_count >= 5
        THEN clock_timestamp()
      ELSE NULL
    END,
    last_error = p_error,
    updated_at = clock_timestamp()
  WHERE request.student_id = p_student_id;
$$;

REVOKE ALL ON FUNCTION public.complete_ucat_preparation_refresh(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ucat_preparation_refresh(UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_completed_ucat_activity_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
     AND NEW.discarded_at IS NULL AND NEW.expired_at IS NULL THEN
    IF TG_TABLE_NAME = 'student_question_set_attempts'
       AND (to_jsonb(NEW) ->> 'student_ucat_mock_attempt_id') IS NOT NULL THEN
      RETURN NEW;
    END IF;
    PERFORM public.enqueue_ucat_preparation_refresh(
      NEW.student_id,
      'activity_completed'
    );
    -- Full canonical regeneration is materially justified by a completed Mock.
    -- Ordinary standalone Sets refresh Score and reconcile equivalent tasks;
    -- weekly maintenance performs the broader rebalancing without turning
    -- every Set completion into a catalogue-wide planning job.
    IF TG_TABLE_NAME = 'student_ucat_mock_attempts' THEN
      PERFORM public.enqueue_ucat_preparation_refresh(
        NEW.student_id,
        'scheduled_rebalance'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_completed_ucat_activity_refresh()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_completed_ucat_set_refresh
AFTER UPDATE OF completed_at ON public.student_question_set_attempts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_completed_ucat_activity_refresh();

CREATE TRIGGER enqueue_completed_ucat_practice_refresh
AFTER UPDATE OF completed_at ON public.student_practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_completed_ucat_activity_refresh();

CREATE TRIGGER enqueue_completed_ucat_mock_refresh
AFTER UPDATE OF completed_at ON public.student_ucat_mock_attempts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_completed_ucat_activity_refresh();

CREATE OR REPLACE FUNCTION public.enqueue_completed_ucat_learning_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.enqueue_ucat_preparation_refresh(
      NEW.student_id,
      'activity_completed'
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_completed_ucat_learning_refresh()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_completed_ucat_learning_refresh
AFTER UPDATE OF completed_at ON public.ucat_student_learning_module_progress
FOR EACH ROW EXECUTE FUNCTION public.enqueue_completed_ucat_learning_refresh();

CREATE TRIGGER enqueue_completed_ucat_skill_trainer_refresh
AFTER UPDATE OF completed_at ON public.student_skill_trainer_attempts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_completed_ucat_learning_refresh();

-- The cron first coalesces due weekly/missed-work maintenance into the same
-- single-flight queue. Ordinary Study-plan reads never inspect or mutate it.
CREATE OR REPLACE FUNCTION public.enqueue_due_ucat_study_plan_rebalances(
  p_limit INTEGER DEFAULT 50
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
  v_student_id UUID;
BEGIN
  FOR v_student_id IN
    SELECT profile.student_id
    FROM public.ucat_student_study_plan_profiles profile
    JOIN public.students student ON student.id = profile.student_id
    WHERE profile.study_plan_enabled
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_student_preparation_refresh_requests request
        WHERE request.student_id = profile.student_id
          AND request.requested_reasons @> ARRAY['scheduled_rebalance']
          AND (
            request.processing_started_at IS NOT NULL
            OR request.dead_lettered_at IS NOT NULL
            OR request.requested_at > coalesce(
              request.completed_at,
              '-infinity'::TIMESTAMPTZ
            )
          )
      )
      AND (
        profile.next_weekly_replan_on IS NULL
        OR profile.next_weekly_replan_on <=
          (clock_timestamp() AT TIME ZONE coalesce(
            student.timezone,
            'Australia/Adelaide'
          ))::DATE
        OR EXISTS (
          SELECT 1
          FROM public.ucat_student_study_plan_tasks task
          WHERE task.student_id = profile.student_id
            AND task.scheduled_date <
              (clock_timestamp() AT TIME ZONE coalesce(
                student.timezone,
                'Australia/Adelaide'
              ))::DATE
            AND task.status IN ('planned', 'partial')
        )
      )
    ORDER BY profile.next_weekly_replan_on NULLS FIRST, profile.student_id
    LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  LOOP
    PERFORM public.enqueue_ucat_preparation_refresh(
      v_student_id,
      'scheduled_rebalance'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_due_ucat_study_plan_rebalances(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_due_ucat_study_plan_rebalances(INTEGER)
  TO service_role;

-- Scheduled maintenance needs two extra set-based patch fields. Keep all
-- task mutations in one round trip and scope them to one Student.
CREATE OR REPLACE FUNCTION public.batch_update_ucat_study_plan_tasks(
  p_student_id UUID,
  p_updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  IF jsonb_typeof(coalesce(p_updates, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'updates_must_be_an_array';
  END IF;
  WITH patches AS (
    SELECT value AS patch
    FROM jsonb_array_elements(coalesce(p_updates, '[]'::JSONB))
  )
  UPDATE public.ucat_student_study_plan_tasks task
  SET
    status = CASE WHEN patches.patch ? 'status'
      THEN patches.patch ->> 'status' ELSE task.status END,
    scheduled_date = CASE WHEN patches.patch ? 'scheduled_date'
      THEN (patches.patch ->> 'scheduled_date')::DATE ELSE task.scheduled_date END,
    skipped_at = CASE WHEN patches.patch ? 'skipped_at'
      THEN (patches.patch ->> 'skipped_at')::TIMESTAMPTZ ELSE task.skipped_at END,
    completed_at = CASE WHEN patches.patch ? 'completed_at'
      THEN (patches.patch ->> 'completed_at')::TIMESTAMPTZ ELSE task.completed_at END,
    completed_units = CASE WHEN patches.patch ? 'completed_units'
      THEN (patches.patch ->> 'completed_units')::NUMERIC ELSE task.completed_units END,
    matched_activity_type = CASE WHEN patches.patch ? 'matched_activity_type'
      THEN patches.patch ->> 'matched_activity_type' ELSE task.matched_activity_type END,
    matched_activity_id = CASE WHEN patches.patch ? 'matched_activity_id'
      THEN (patches.patch ->> 'matched_activity_id')::UUID ELSE task.matched_activity_id END,
    launch_path = CASE WHEN patches.patch ? 'launch_path'
      THEN patches.patch ->> 'launch_path' ELSE task.launch_path END,
    launch_config = CASE WHEN patches.patch ? 'launch_config'
      THEN patches.patch -> 'launch_config' ELSE task.launch_config END,
    updated_at = now()
  FROM patches
  WHERE task.id = (patches.patch ->> 'id')::UUID
    AND task.student_id = p_student_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- The trajectory model version changes in the same release. Warm compatible
-- snapshots for every existing UCAT Student instead of making them wait for a
-- new activity before Score projection becomes available again.
INSERT INTO public.ucat_student_preparation_refresh_requests (
  student_id,
  requested_at,
  requested_reasons,
  next_attempt_at,
  updated_at
)
SELECT DISTINCT
  student.student_id,
  clock_timestamp(),
  ARRAY['projection_model_upgrade'],
  clock_timestamp(),
  clock_timestamp()
FROM (
  SELECT profile.student_id
  FROM public.ucat_student_study_plan_profiles profile
  UNION
  SELECT relationship.student_id
  FROM public.student_online_product_relationships relationship
  WHERE relationship.product = 'UCAT_WEB'
    AND relationship.closed_at IS NULL
) student
ON CONFLICT (student_id) DO UPDATE
SET
  requested_at = excluded.requested_at,
  next_attempt_at = excluded.next_attempt_at,
  requested_reasons = ARRAY(
    SELECT DISTINCT reason
    FROM unnest(
      public.ucat_student_preparation_refresh_requests.requested_reasons
        || excluded.requested_reasons
    ) reason
    ORDER BY reason
  ),
  updated_at = excluded.updated_at;

COMMENT ON TABLE public.ucat_student_preparation_refresh_requests IS
  'Coalesced durable work requests for independent score-projection refresh and event-driven Study-plan reconciliation.';
