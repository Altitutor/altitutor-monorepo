-- Keep Study-plan maintenance proportional to recently engaged, eligible
-- Students and make durable refresh execution safe under concurrency.

ALTER TABLE public.ucat_student_study_plan_profiles
  ADD COLUMN last_authenticated_visit_at TIMESTAMPTZ,
  ADD COLUMN last_missed_work_replan_on DATE,
  ADD COLUMN next_maintenance_at TIMESTAMPTZ;

ALTER TABLE public.ucat_student_study_plan_generations
  ADD COLUMN refresh_request_version BIGINT;

CREATE UNIQUE INDEX ucat_study_plan_generation_refresh_version_idx
  ON public.ucat_student_study_plan_generations (
    student_id,
    refresh_request_version
  )
  WHERE refresh_request_version IS NOT NULL;

CREATE INDEX ucat_study_plan_profile_due_maintenance_idx
  ON public.ucat_student_study_plan_profiles (next_maintenance_at, student_id)
  WHERE study_plan_enabled AND setup_completed_at IS NOT NULL;

CREATE INDEX ucat_study_plan_active_incomplete_tasks_idx
  ON public.ucat_student_study_plan_tasks (
    generation_id,
    scheduled_date,
    student_id
  )
  WHERE status IN ('planned', 'partial');

CREATE INDEX ucat_study_plan_learning_history_idx
  ON public.ucat_student_study_plan_tasks (student_id)
  INCLUDE (section_id, scheduled_date, started_at, completed_at)
  WHERE task_type = 'learn' AND status IN ('in_progress', 'completed');

ALTER TABLE public.ucat_student_preparation_refresh_requests
  ADD COLUMN request_version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN claimed_version BIGINT,
  ADD COLUMN claim_token UUID,
  ADD COLUMN claimed_reasons TEXT[];

CREATE OR REPLACE FUNCTION public.enqueue_ucat_preparation_refresh(
  p_student_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'refresh_reason_required';
  END IF;

  INSERT INTO public.ucat_student_preparation_refresh_requests (
    student_id,
    requested_at,
    requested_reasons,
    next_attempt_at,
    request_version,
    updated_at
  ) VALUES (
    p_student_id,
    v_now,
    ARRAY[p_reason],
    v_now,
    1,
    v_now
  )
  ON CONFLICT (student_id) DO UPDATE
  SET
    request_version = CASE
      WHEN p_reason = 'scheduled_rebalance'
        AND public.ucat_student_preparation_refresh_requests.requested_at
          > coalesce(
            public.ucat_student_preparation_refresh_requests.completed_at,
            '-infinity'::TIMESTAMPTZ
          )
        THEN public.ucat_student_preparation_refresh_requests.request_version
      ELSE public.ucat_student_preparation_refresh_requests.request_version + 1
    END,
    requested_at = CASE
      WHEN p_reason = 'scheduled_rebalance'
        AND public.ucat_student_preparation_refresh_requests.requested_at
          > coalesce(
            public.ucat_student_preparation_refresh_requests.completed_at,
            '-infinity'::TIMESTAMPTZ
          )
        THEN public.ucat_student_preparation_refresh_requests.requested_at
      ELSE v_now
    END,
    requested_reasons = ARRAY(
      SELECT DISTINCT reason
      FROM unnest(
        public.ucat_student_preparation_refresh_requests.requested_reasons
          || ARRAY[p_reason]
      ) reason
      ORDER BY reason
    ),
    next_attempt_at = CASE
      WHEN p_reason <> 'scheduled_rebalance' THEN v_now
      WHEN public.ucat_student_preparation_refresh_requests.requested_at
        <= coalesce(
          public.ucat_student_preparation_refresh_requests.completed_at,
          '-infinity'::TIMESTAMPTZ
        ) THEN v_now
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
        ) THEN 0
      ELSE public.ucat_student_preparation_refresh_requests.attempt_count
    END,
    updated_at = v_now;
END;
$$;

DROP FUNCTION public.claim_ucat_preparation_refreshes(INTEGER, UUID);

CREATE FUNCTION public.claim_ucat_preparation_refreshes(
  p_limit INTEGER DEFAULT 10,
  p_student_id UUID DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  requested_reasons TEXT[],
  request_version BIGINT,
  claim_token UUID
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
    claimed_version = request.request_version,
    claim_token = gen_random_uuid(),
    claimed_reasons = request.requested_reasons,
    attempt_count = request.attempt_count + 1,
    last_error = NULL,
    updated_at = clock_timestamp()
  FROM candidates
  WHERE request.student_id = candidates.student_id
  RETURNING
    request.student_id,
    request.claimed_reasons,
    request.claimed_version,
    request.claim_token;
$$;

REVOKE ALL ON FUNCTION public.claim_ucat_preparation_refreshes(INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ucat_preparation_refreshes(INTEGER, UUID)
  TO service_role;

DROP FUNCTION public.complete_ucat_preparation_refresh(UUID, TEXT);

CREATE FUNCTION public.complete_ucat_preparation_refresh(
  p_student_id UUID,
  p_claim_token UUID,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE public.ucat_student_preparation_refresh_requests request
  SET
    processing_started_at = NULL,
    claimed_version = NULL,
    claim_token = NULL,
    claimed_reasons = NULL,
    completed_at = CASE
      WHEN p_error IS NULL THEN request.processing_started_at
      ELSE request.completed_at
    END,
    requested_reasons = CASE
      WHEN p_error IS NULL AND request.request_version = request.claimed_version
        THEN '{}'::TEXT[]
      ELSE request.requested_reasons
    END,
    attempt_count = CASE WHEN p_error IS NULL THEN 0 ELSE request.attempt_count END,
    next_attempt_at = CASE
      WHEN p_error IS NULL THEN clock_timestamp()
      ELSE clock_timestamp() + make_interval(
        secs => least(
          3600,
          60 * power(2, greatest(request.attempt_count - 1, 0))
        )::INTEGER
      )
    END,
    dead_lettered_at = CASE
      WHEN p_error IS NOT NULL AND request.attempt_count >= 5
        THEN clock_timestamp()
      ELSE NULL
    END,
    last_error = p_error,
    updated_at = clock_timestamp()
  WHERE request.student_id = p_student_id
    AND request.claim_token = p_claim_token;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_ucat_preparation_refresh(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ucat_preparation_refresh(UUID, UUID, TEXT)
  TO service_role;

-- Supabase migrations deploy before the matching Vercel build. Keep the old
-- signature during that rolling window, but never let an unfenced legacy
-- worker acknowledge work. Expire its lease so a new worker can reclaim it
-- immediately after the application deployment completes.
CREATE FUNCTION public.complete_ucat_preparation_refresh(
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
    processing_started_at = clock_timestamp() - interval '11 minutes',
    next_attempt_at = clock_timestamp(),
    last_error = coalesce(
      p_error,
      'legacy_worker_completion_released_for_fenced_retry'
    ),
    updated_at = clock_timestamp()
  WHERE request.student_id = p_student_id
    AND request.claim_token IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.complete_ucat_preparation_refresh(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ucat_preparation_refresh(UUID, TEXT)
  TO service_role;

CREATE FUNCTION public.redrive_ucat_preparation_refresh(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE public.ucat_student_preparation_refresh_requests request
  SET
    requested_at = clock_timestamp(),
    request_version = request.request_version + 1,
    processing_started_at = NULL,
    claimed_version = NULL,
    claim_token = NULL,
    claimed_reasons = NULL,
    attempt_count = 0,
    next_attempt_at = clock_timestamp(),
    dead_lettered_at = NULL,
    last_error = NULL,
    updated_at = clock_timestamp()
  WHERE request.student_id = p_student_id
    AND request.dead_lettered_at IS NOT NULL;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.redrive_ucat_preparation_refresh(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redrive_ucat_preparation_refresh(UUID)
  TO service_role;

CREATE FUNCTION public.recompute_ucat_study_plan_maintenance_at(
  p_student_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
  v_weekly_on DATE;
  v_missed_on DATE;
  v_last_missed_on DATE;
  v_next TIMESTAMPTZ;
BEGIN
  SELECT
    coalesce(nullif(student.timezone, ''), 'Australia/Adelaide'),
    profile.next_weekly_replan_on,
    profile.last_missed_work_replan_on
  INTO v_timezone, v_weekly_on, v_last_missed_on
  FROM public.ucat_student_study_plan_profiles profile
  JOIN public.students student ON student.id = profile.student_id
  WHERE profile.student_id = p_student_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT min(task.scheduled_date + 1)
  INTO v_missed_on
  FROM public.ucat_student_study_plan_generations generation
  JOIN public.ucat_student_study_plan_tasks task
    ON task.generation_id = generation.id
  WHERE generation.student_id = p_student_id
    AND generation.superseded_at IS NULL
    AND task.status IN ('planned', 'partial');

  IF v_missed_on IS NOT NULL AND v_last_missed_on IS NOT NULL THEN
    v_missed_on := greatest(v_missed_on, v_last_missed_on + 1);
  END IF;

  SELECT min(candidate.at_time)
  INTO v_next
  FROM (VALUES
    (CASE WHEN v_weekly_on IS NULL THEN NULL ELSE
      v_weekly_on::TIMESTAMP AT TIME ZONE v_timezone END),
    (CASE WHEN v_missed_on IS NULL THEN NULL ELSE
      v_missed_on::TIMESTAMP AT TIME ZONE v_timezone END)
  ) candidate(at_time)
  WHERE candidate.at_time IS NOT NULL;

  UPDATE public.ucat_student_study_plan_profiles
  SET next_maintenance_at = v_next
  WHERE student_id = p_student_id;
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_ucat_study_plan_maintenance_at(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.refresh_ucat_study_plan_maintenance_after_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student_id UUID;
BEGIN
  FOR v_student_id IN
    SELECT DISTINCT student_id FROM new_task_rows
  LOOP
    PERFORM public.recompute_ucat_study_plan_maintenance_at(v_student_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER refresh_ucat_study_plan_maintenance_after_task_update
AFTER UPDATE ON public.ucat_student_study_plan_tasks
REFERENCING NEW TABLE AS new_task_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_ucat_study_plan_maintenance_after_task_update();

CREATE FUNCTION public.refresh_ucat_study_plan_maintenance_after_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.recompute_ucat_study_plan_maintenance_at(NEW.student_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER refresh_ucat_study_plan_maintenance_after_profile_update
AFTER UPDATE OF next_weekly_replan_on
ON public.ucat_student_study_plan_profiles
FOR EACH ROW
EXECUTE FUNCTION public.refresh_ucat_study_plan_maintenance_after_profile_update();

CREATE FUNCTION public.record_current_ucat_authenticated_visit()
RETURNS TABLE (recorded BOOLEAN, refresh_pending BOOLEAN)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id UUID;
  v_profile public.ucat_student_study_plan_profiles%ROWTYPE;
  v_timezone TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_local_today DATE;
  v_cycle_end DATE;
  v_previous_visit TIMESTAMPTZ;
  v_has_relationship BOOLEAN;
  v_should_refresh BOOLEAN := FALSE;
BEGIN
  SELECT student.id, coalesce(nullif(student.timezone, ''), 'Australia/Adelaide')
  INTO v_student_id, v_timezone
  FROM public.students student
  WHERE student.user_id = (SELECT auth.uid());

  IF v_student_id IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE;
    RETURN;
  END IF;

  SELECT * INTO v_profile
  FROM public.ucat_student_study_plan_profiles profile
  WHERE profile.student_id = v_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE;
    RETURN;
  END IF;

  v_previous_visit := v_profile.last_authenticated_visit_at;
  v_local_today := (v_now AT TIME ZONE v_timezone)::DATE;
  SELECT coalesce(
    v_profile.test_date,
    test_window.testing_ends_on,
    make_date(v_profile.test_year, 12, 31)
  )
  INTO v_cycle_end
  FROM (SELECT 1) singleton
  LEFT JOIN public.ucat_study_plan_test_windows test_window
    ON test_window.test_year = v_profile.test_year;
  SELECT EXISTS (
    SELECT 1
    FROM public.student_online_product_relationships relationship
    WHERE relationship.student_id = v_student_id
      AND relationship.product = 'UCAT_WEB'
      AND relationship.closed_at IS NULL
  ) INTO v_has_relationship;

  IF v_previous_visit IS NULL OR v_previous_visit < v_now - interval '1 day' THEN
    UPDATE public.ucat_student_study_plan_profiles
    SET last_authenticated_visit_at = v_now
    WHERE student_id = v_student_id;
  END IF;

  v_should_refresh :=
    v_profile.study_plan_enabled
    AND v_profile.setup_completed_at IS NOT NULL
    AND v_has_relationship
    AND v_local_today <= v_cycle_end
    AND (
      v_previous_visit IS NULL
      OR v_previous_visit < v_now - interval '14 days'
      OR v_profile.last_generated_at IS NULL
      OR v_profile.next_maintenance_at IS NULL
      OR v_profile.next_maintenance_at <= v_now
      OR EXISTS (
        SELECT 1
        FROM public.ucat_student_preparation_refresh_requests request
        WHERE request.student_id = v_student_id
          AND request.dead_lettered_at IS NOT NULL
      )
    );

  IF v_should_refresh THEN
    PERFORM public.enqueue_ucat_preparation_refresh(
      v_student_id,
      'student_returned'
    );
  END IF;

  RETURN QUERY SELECT
    v_previous_visit IS NULL OR v_previous_visit < v_now - interval '1 day',
    v_should_refresh OR EXISTS (
      SELECT 1
      FROM public.ucat_student_preparation_refresh_requests request
      WHERE request.student_id = v_student_id
        AND request.dead_lettered_at IS NULL
        AND request.requested_at > coalesce(
          request.completed_at,
          '-infinity'::TIMESTAMPTZ
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_current_ucat_authenticated_visit()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_current_ucat_authenticated_visit()
  TO authenticated, service_role;

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
    LEFT JOIN public.ucat_study_plan_test_windows test_window
      ON test_window.test_year = profile.test_year
    WHERE profile.study_plan_enabled
      AND profile.setup_completed_at IS NOT NULL
      AND profile.last_authenticated_visit_at >=
        clock_timestamp() - interval '14 days'
      AND profile.next_maintenance_at <= clock_timestamp()
      AND (clock_timestamp() AT TIME ZONE coalesce(
        nullif(student.timezone, ''),
        'Australia/Adelaide'
      ))::DATE <= coalesce(
        profile.test_date,
        test_window.testing_ends_on,
        make_date(profile.test_year, 12, 31)
      )
      AND EXISTS (
        SELECT 1
        FROM public.student_online_product_relationships relationship
        WHERE relationship.student_id = profile.student_id
          AND relationship.product = 'UCAT_WEB'
          AND relationship.closed_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_student_preparation_refresh_requests request
        WHERE request.student_id = profile.student_id
          AND request.requested_reasons &&
            ARRAY['scheduled_rebalance', 'student_returned']
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
            nullif(student.timezone, ''),
            'Australia/Adelaide'
          ))::DATE
        OR (
          profile.last_missed_work_replan_on IS DISTINCT FROM
            (clock_timestamp() AT TIME ZONE coalesce(
              nullif(student.timezone, ''),
              'Australia/Adelaide'
            ))::DATE
          AND EXISTS (
            SELECT 1
            FROM public.ucat_student_study_plan_generations generation
            JOIN public.ucat_student_study_plan_tasks task
              ON task.generation_id = generation.id
            WHERE generation.student_id = profile.student_id
              AND generation.superseded_at IS NULL
              AND task.scheduled_date <
                (clock_timestamp() AT TIME ZONE coalesce(
                  nullif(student.timezone, ''),
                  'Australia/Adelaide'
                ))::DATE
              AND task.status IN ('planned', 'partial')
          )
        )
      )
    ORDER BY profile.next_maintenance_at, profile.student_id
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

CREATE FUNCTION public.list_ucat_study_plan_maintenance_anomalies(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (student_id UUID, anomaly TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.student_id, 'missing_ucat_online_product_relationship'::TEXT
  FROM public.ucat_student_study_plan_profiles profile
  WHERE profile.study_plan_enabled
    AND profile.setup_completed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.student_online_product_relationships relationship
      WHERE relationship.student_id = profile.student_id
        AND relationship.product = 'UCAT_WEB'
        AND relationship.closed_at IS NULL
    )
  ORDER BY profile.student_id
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.list_ucat_study_plan_maintenance_anomalies(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_ucat_study_plan_maintenance_anomalies(INTEGER)
  TO service_role;

CREATE FUNCTION public.replace_ucat_study_plan_generation_for_refresh(
  p_student_id UUID,
  p_profile_id UUID,
  p_reason TEXT,
  p_planning_date DATE,
  p_starts_on DATE,
  p_ends_on DATE,
  p_input_snapshot JSONB,
  p_projection_snapshot JSONB,
  p_capacity_risk JSONB,
  p_tasks JSONB,
  p_next_weekly_replan_on DATE,
  p_setup_completed_at TIMESTAMPTZ,
  p_preserve_through DATE,
  p_refresh_request_version BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_old_generation public.ucat_student_study_plan_generations%ROWTYPE;
  v_generation_id UUID := gen_random_uuid();
  v_existing_generation_id UUID;
  v_generated_at TIMESTAMPTZ := clock_timestamp();
  v_starts_on DATE := p_starts_on;
BEGIN
  PERFORM 1
  FROM public.ucat_student_study_plan_profiles
  WHERE id = p_profile_id AND student_id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study plan profile does not belong to student';
  END IF;

  SELECT generation.id INTO v_existing_generation_id
  FROM public.ucat_student_study_plan_generations generation
  WHERE generation.student_id = p_student_id
    AND generation.refresh_request_version = p_refresh_request_version;
  IF v_existing_generation_id IS NOT NULL THEN
    RETURN v_existing_generation_id;
  END IF;

  SELECT * INTO v_old_generation
  FROM public.ucat_student_study_plan_generations
  WHERE student_id = p_student_id AND superseded_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    v_starts_on := least(v_old_generation.starts_on, p_starts_on);
    UPDATE public.ucat_student_study_plan_generations
    SET superseded_at = v_generated_at
    WHERE id = v_old_generation.id;
  END IF;

  INSERT INTO public.ucat_student_study_plan_generations (
    id, student_id, profile_id, reason, planning_date, starts_on, ends_on,
    input_snapshot, projection_snapshot, capacity_risk, generated_at,
    refresh_request_version
  ) VALUES (
    v_generation_id, p_student_id, p_profile_id, p_reason, p_planning_date,
    v_starts_on, p_ends_on, coalesce(p_input_snapshot, '{}'::JSONB),
    coalesce(p_projection_snapshot, '{}'::JSONB), p_capacity_risk,
    v_generated_at, p_refresh_request_version
  );

  IF v_old_generation.id IS NOT NULL AND p_preserve_through IS NOT NULL THEN
    UPDATE public.ucat_student_study_plan_tasks
    SET generation_id = v_generation_id
    WHERE generation_id = v_old_generation.id
      AND scheduled_date <= p_preserve_through;

    UPDATE public.ucat_student_study_plan_tasks AS review
    SET generation_id = v_generation_id
    WHERE review.generation_id = v_old_generation.id
      AND review.source_task_id IN (
        SELECT source.id
        FROM public.ucat_student_study_plan_tasks AS source
        WHERE source.generation_id = v_generation_id
      );

    UPDATE public.ucat_student_study_plan_tasks
    SET sort_order = sort_order + 1000000
    WHERE generation_id = v_generation_id
      AND task_type = 'review'
      AND scheduled_date > p_preserve_through
      AND source_task_id IS NOT NULL;

    WITH ranked_reviews AS (
      SELECT id, row_number() OVER (
        PARTITION BY scheduled_date ORDER BY sort_order, id
      ) - 1 AS next_sort_order
      FROM public.ucat_student_study_plan_tasks
      WHERE generation_id = v_generation_id
        AND task_type = 'review'
        AND scheduled_date > p_preserve_through
        AND source_task_id IS NOT NULL
    )
    UPDATE public.ucat_student_study_plan_tasks AS review
    SET sort_order = ranked.next_sort_order
    FROM ranked_reviews AS ranked
    WHERE review.id = ranked.id;
  END IF;

  INSERT INTO public.ucat_student_study_plan_tasks (
    id, generation_id, student_id, scheduled_date, sort_order, task_type,
    title, description, rationale, estimated_minutes, target_units, section_id,
    question_stem_category_id, question_tag_id, learning_module_id,
    question_set_id, mock_id, skill_trainer_id, launch_path, launch_config,
    source_task_id
  )
  SELECT
    task.id, v_generation_id, p_student_id, task.scheduled_date,
    task.sort_order + coalesce(carried_review.count, 0), task.task_type,
    task.title, task.description, task.rationale, task.estimated_minutes,
    task.target_units, task.section_id, task.question_stem_category_id,
    task.question_tag_id, task.learning_module_id, task.question_set_id,
    task.mock_id, task.skill_trainer_id, task.launch_path,
    coalesce(task.launch_config, '{}'::JSONB), task.source_task_id
  FROM jsonb_to_recordset(coalesce(p_tasks, '[]'::JSONB)) AS task(
    id UUID, scheduled_date DATE, sort_order INTEGER, task_type TEXT,
    title TEXT, description TEXT, rationale TEXT, estimated_minutes INTEGER,
    target_units INTEGER, section_id UUID, question_stem_category_id UUID,
    question_tag_id UUID, learning_module_id UUID, question_set_id UUID,
    mock_id UUID, skill_trainer_id UUID, launch_path TEXT, launch_config JSONB,
    source_task_id UUID
  )
  LEFT JOIN LATERAL (
    SELECT count(*)::INTEGER AS count
    FROM public.ucat_student_study_plan_tasks AS preserved_review
    WHERE preserved_review.generation_id = v_generation_id
      AND preserved_review.task_type = 'review'
      AND preserved_review.source_task_id IS NOT NULL
      AND preserved_review.scheduled_date = task.scheduled_date
      AND preserved_review.scheduled_date > p_preserve_through
  ) AS carried_review ON TRUE;

  UPDATE public.ucat_student_study_plan_profiles
  SET last_generated_at = v_generated_at,
      next_weekly_replan_on = p_next_weekly_replan_on,
      last_missed_work_replan_on = p_preserve_through,
      setup_completed_at = coalesce(setup_completed_at, p_setup_completed_at)
  WHERE id = p_profile_id;

  IF v_old_generation.id IS NOT NULL AND p_preserve_through IS NOT NULL THEN
    LOOP
      DELETE FROM public.ucat_student_study_plan_tasks task
      WHERE task.generation_id = v_old_generation.id
        AND task.scheduled_date > p_preserve_through
        AND task.status = 'planned'
        AND task.completed_units = 0
        AND task.started_at IS NULL
        AND task.completed_at IS NULL
        AND task.skipped_at IS NULL
        AND task.matched_activity_type IS NULL
        AND task.matched_activity_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.ucat_student_study_plan_tasks dependent
          WHERE dependent.source_task_id = task.id
        );
      EXIT WHEN NOT FOUND;
    END LOOP;
  END IF;

  PERFORM public.recompute_ucat_study_plan_maintenance_at(p_student_id);
  RETURN v_generation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_ucat_study_plan_generation_for_refresh(
  UUID, UUID, TEXT, DATE, DATE, DATE, JSONB, JSONB, JSONB, JSONB, DATE,
  TIMESTAMPTZ, DATE, BIGINT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_ucat_study_plan_generation_for_refresh(
  UUID, UUID, TEXT, DATE, DATE, DATE, JSONB, JSONB, JSONB, JSONB, DATE,
  TIMESTAMPTZ, DATE, BIGINT
) TO service_role;

-- Remove only evidence-free future leaf drafts from superseded generations.
-- Repeating the statement allows disposable reviews to disappear before their
-- disposable source while preserving any source with an evidence-bearing child.
DO $$
BEGIN
  LOOP
    DELETE FROM public.ucat_student_study_plan_tasks task
    USING public.ucat_student_study_plan_generations generation,
          public.students student
    WHERE task.generation_id = generation.id
      AND student.id = task.student_id
      AND generation.superseded_at IS NOT NULL
      AND task.scheduled_date > (
        generation.superseded_at AT TIME ZONE coalesce(
          nullif(student.timezone, ''),
          'Australia/Adelaide'
        )
      )::DATE
      AND task.status = 'planned'
      AND task.completed_units = 0
      AND task.started_at IS NULL
      AND task.completed_at IS NULL
      AND task.skipped_at IS NULL
      AND task.matched_activity_type IS NULL
      AND task.matched_activity_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.ucat_student_study_plan_tasks dependent
        WHERE dependent.source_task_id = task.id
      );
    EXIT WHEN NOT FOUND;
  END LOOP;
END;
$$;

DO $$
DECLARE v_student_id UUID;
BEGIN
  FOR v_student_id IN
    SELECT student_id FROM public.ucat_student_study_plan_profiles
  LOOP
    PERFORM public.recompute_ucat_study_plan_maintenance_at(v_student_id);
  END LOOP;
END;
$$;

COMMENT ON COLUMN public.ucat_student_study_plan_profiles.last_authenticated_visit_at IS
  'Most recent coalesced authenticated UCAT visit; scheduled maintenance pauses after fourteen days.';
COMMENT ON COLUMN public.ucat_student_study_plan_profiles.next_maintenance_at IS
  'Indexed UTC watermark for the next weekly or missed-work maintenance check.';
COMMENT ON FUNCTION public.redrive_ucat_preparation_refresh(UUID) IS
  'Service-only manual recovery for a dead-lettered UCAT preparation refresh.';
