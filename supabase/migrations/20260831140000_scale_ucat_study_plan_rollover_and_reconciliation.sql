-- Separate cheap missed-work rollover from canonical generation, keep Practice
-- catalogue selection at launch, and make Learning reconciliation task-owned.

ALTER TABLE public.ucat_student_study_plan_tasks
  ADD COLUMN skipped_reason TEXT;

ALTER TABLE public.ucat_student_study_plan_tasks
  ADD CONSTRAINT ucat_student_study_plan_tasks_skipped_reason_check
  CHECK (
    skipped_reason IS NULL OR skipped_reason IN (
      'manual',
      'rollover',
      'module_completed_elsewhere'
    )
  );

ALTER TABLE public.ucat_student_learning_module_progress
  ADD COLUMN study_plan_task_id UUID
  REFERENCES public.ucat_student_study_plan_tasks(id) ON DELETE SET NULL;

CREATE INDEX ucat_student_learning_progress_plan_task_idx
  ON public.ucat_student_learning_module_progress (study_plan_task_id)
  WHERE study_plan_task_id IS NOT NULL;

ALTER TABLE public.ucat_student_study_plan_profiles
  ADD COLUMN next_weekly_replan_at TIMESTAMPTZ,
  ADD COLUMN next_rollover_at TIMESTAMPTZ;

CREATE INDEX ucat_study_plan_profiles_weekly_due_idx
  ON public.ucat_student_study_plan_profiles (next_weekly_replan_at, student_id)
  WHERE study_plan_enabled;

CREATE INDEX ucat_study_plan_profiles_rollover_due_idx
  ON public.ucat_student_study_plan_profiles (next_rollover_at, student_id)
  WHERE study_plan_enabled;

CREATE TABLE public.ucat_student_study_plan_exposure_debts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  question_stem_category_id UUID
    REFERENCES public.question_stem_categories(id) ON DELETE CASCADE,
  debt_units NUMERIC NOT NULL DEFAULT 0 CHECK (debt_units >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX ucat_study_plan_exposure_debts_target_idx
  ON public.ucat_student_study_plan_exposure_debts (
    student_id,
    section_id,
    question_stem_category_id
  ) NULLS NOT DISTINCT;

ALTER TABLE public.ucat_student_study_plan_exposure_debts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ucat_student_study_plan_exposure_debts IS
  'Capped Practice exposure missed by one Student, used as a bounded weighting signal by later canonical generation.';

-- Tag weakness is Student evidence, not catalogue availability. Exact tag
-- fulfilment and fallback belong to Practice launch.
CREATE FUNCTION public.get_student_ucat_activity_tag_weakness_signals(
  p_student_id UUID
)
RETURNS TABLE (
  tag_id UUID,
  section_id UUID,
  category_id UUID,
  independent_session_count INTEGER,
  weakness_score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    link.tag_id,
    stem.section_id,
    stem.question_stem_category_id,
    count(DISTINCT coalesce(
      'practice:' || attempt.student_practice_session_id::TEXT,
      'set:' || attempt.student_question_set_attempt_id::TEXT,
      'attempt:' || attempt.id::TEXT
    ))::INTEGER AS independent_session_count,
    avg(CASE WHEN attempt.score > 0 THEN 0::NUMERIC ELSE 1::NUMERIC END)
      AS weakness_score
  FROM public.student_question_attempts attempt
  JOIN public.ucat_questions question ON question.id = attempt.question_id
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.questions_question_tags link ON link.question_id = question.id
  WHERE attempt.student_id = p_student_id
    AND attempt.is_submitted
    AND stem.section_id IS NOT NULL
    AND stem.question_stem_category_id IS NOT NULL
  GROUP BY link.tag_id, stem.section_id, stem.question_stem_category_id;
$$;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_activity_tag_weakness_signals(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_activity_tag_weakness_signals(UUID)
  TO service_role;

-- An explicit Study-plan launch may claim the one durable module-progress row.
-- Independent Learn activity leaves the owner null for narrow reconciliation.
DROP FUNCTION public.start_ucat_learning_module(UUID, UUID);

CREATE FUNCTION public.start_ucat_learning_module(
  p_student_id UUID,
  p_learning_module_id UUID,
  p_study_plan_task_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_rejection JSONB;
  v_created BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_learning_modules module
    WHERE module.id = p_learning_module_id
      AND module.kind = 'lesson'
      AND module.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_study_plan_task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.ucat_student_study_plan_tasks task
    JOIN public.ucat_student_study_plan_generations generation
      ON generation.id = task.generation_id
    WHERE task.id = p_study_plan_task_id
      AND task.student_id = p_student_id
      AND task.task_type = 'learn'
      AND task.learning_module_id = p_learning_module_id
      AND task.status NOT IN ('completed', 'skipped')
      AND generation.superseded_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid_study_plan_learning_task';
  END IF;

  IF p_study_plan_task_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.ucat_student_learning_module_progress progress
    JOIN public.ucat_student_study_plan_tasks owner
      ON owner.id = progress.study_plan_task_id
    WHERE progress.student_id = p_student_id
      AND progress.learning_module_id = p_learning_module_id
      AND progress.study_plan_task_id <> p_study_plan_task_id
      AND owner.status NOT IN ('completed', 'skipped')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid_study_plan_learning_task';
  END IF;

  v_rejection := public.ucat_quota_rejection_for_start(
    p_student_id,
    'learn',
    p_learning_module_id
  );
  IF v_rejection IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'quota_exceeded',
      'quota', v_rejection
    );
  END IF;

  INSERT INTO public.ucat_student_learning_module_progress (
    student_id,
    learning_module_id,
    completion_percent,
    study_plan_task_id
  ) VALUES (
    p_student_id,
    p_learning_module_id,
    0,
    p_study_plan_task_id
  )
  ON CONFLICT (student_id, learning_module_id) DO UPDATE
  SET study_plan_task_id = CASE
    WHEN excluded.study_plan_task_id IS NOT NULL
      THEN excluded.study_plan_task_id
    ELSE public.ucat_student_learning_module_progress.study_plan_task_id
  END
  RETURNING (xmax = 0) INTO v_created;

  RETURN jsonb_build_object('status', 'started', 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION
  public.start_ucat_learning_module(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.start_ucat_learning_module(UUID, UUID, UUID)
  TO service_role;

-- Debt changes are bounded to two section-equivalents. Manual unskip reverses
-- its own projection; later scheduling or completion can never make debt
-- negative.
CREATE FUNCTION public.project_ucat_study_plan_task_exposure_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_units NUMERIC;
  v_cap NUMERIC;
  v_optional BOOLEAN;
BEGIN
  IF NEW.task_type <> 'practice' OR NEW.section_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_optional := coalesce((NEW.launch_config ->> 'optional')::BOOLEAN, FALSE);
  IF v_optional THEN RETURN NEW; END IF;

  IF NOT (
    (OLD.status <> 'skipped' AND NEW.status = 'skipped')
    OR (OLD.status = 'skipped' AND NEW.status <> 'skipped')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT greatest(coalesce(section.number_of_questions, 20) * 2, 20)
  INTO v_cap
  FROM public.ucat_sections section
  WHERE section.id = NEW.section_id;

  v_units := greatest(
    coalesce(NEW.target_units, 1) - coalesce(NEW.completed_units, 0),
    0
  );
  IF v_units = 0 THEN RETURN NEW; END IF;

  IF NEW.status = 'skipped' THEN
    INSERT INTO public.ucat_student_study_plan_exposure_debts (
      student_id,
      section_id,
      question_stem_category_id,
      debt_units
    ) VALUES (
      NEW.student_id,
      NEW.section_id,
      NEW.question_stem_category_id,
      least(v_units, v_cap)
    )
    ON CONFLICT (student_id, section_id, question_stem_category_id)
    DO UPDATE SET
      debt_units = least(
        v_cap,
        public.ucat_student_study_plan_exposure_debts.debt_units
          + excluded.debt_units
      ),
      updated_at = clock_timestamp();
  ELSE
    UPDATE public.ucat_student_study_plan_exposure_debts debt
    SET debt_units = greatest(0, debt.debt_units - v_units),
        updated_at = clock_timestamp()
    WHERE debt.student_id = NEW.student_id
      AND debt.section_id = NEW.section_id
      AND debt.question_stem_category_id IS NOT DISTINCT FROM
        NEW.question_stem_category_id;
    DELETE FROM public.ucat_student_study_plan_exposure_debts debt
    WHERE debt.student_id = NEW.student_id
      AND debt.debt_units = 0;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.project_ucat_study_plan_task_exposure_debt()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER project_ucat_study_plan_task_exposure_debt
AFTER UPDATE OF status
ON public.ucat_student_study_plan_tasks
FOR EACH ROW
EXECUTE FUNCTION public.project_ucat_study_plan_task_exposure_debt();

-- Reserving replacement exposure consumes half of the matching debt. Actual
-- completion consumes the other half, so another miss still increases debt.
CREATE FUNCTION public.credit_ucat_study_plan_scheduled_exposure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  WITH scheduled AS (
    SELECT
      task.student_id,
      task.section_id,
      task.question_stem_category_id,
      sum(coalesce(task.target_units, 0))::NUMERIC * 0.5 AS credit_units
    FROM new_task_rows task
    WHERE task.task_type = 'practice'
      AND task.section_id IS NOT NULL
      AND NOT coalesce((task.launch_config ->> 'optional')::BOOLEAN, FALSE)
    GROUP BY
      task.student_id,
      task.section_id,
      task.question_stem_category_id
  ), credits AS (
    SELECT
      debt.id,
      CASE
        WHEN debt.question_stem_category_id IS NULL THEN coalesce((
          SELECT sum(item.credit_units)
          FROM scheduled item
          WHERE item.student_id = debt.student_id
            AND item.section_id = debt.section_id
        ), 0)
        ELSE coalesce((
          SELECT sum(item.credit_units)
          FROM scheduled item
          WHERE item.student_id = debt.student_id
            AND item.section_id = debt.section_id
            AND item.question_stem_category_id =
              debt.question_stem_category_id
        ), 0)
      END AS credit_units
    FROM public.ucat_student_study_plan_exposure_debts debt
    WHERE EXISTS (
      SELECT 1 FROM scheduled item
      WHERE item.student_id = debt.student_id
        AND item.section_id = debt.section_id
    )
  )
  UPDATE public.ucat_student_study_plan_exposure_debts debt
  SET debt_units = greatest(0, debt.debt_units - credits.credit_units),
      updated_at = clock_timestamp()
  FROM credits
  WHERE debt.id = credits.id
    AND credits.credit_units > 0;

  DELETE FROM public.ucat_student_study_plan_exposure_debts
  WHERE debt_units = 0;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_ucat_study_plan_scheduled_exposure()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER credit_ucat_study_plan_scheduled_exposure
AFTER INSERT ON public.ucat_student_study_plan_tasks
REFERENCING NEW TABLE AS new_task_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.credit_ucat_study_plan_scheduled_exposure();

CREATE FUNCTION public.credit_ucat_study_plan_completed_exposure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_ids UUID[];
  v_credit NUMERIC;
BEGIN
  IF OLD.completed_at IS NOT NULL OR NEW.completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(array_agg(value::UUID), ARRAY[]::UUID[])
  INTO v_category_ids
  FROM jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(NEW.filters_snapshot -> 'categoryIds') = 'array'
        THEN NEW.filters_snapshot -> 'categoryIds'
      ELSE '[]'::JSONB
    END
  ) value;

  v_credit := greatest(coalesce(NEW.question_count, 0), 0) * 0.5;
  IF v_credit = 0 THEN RETURN NEW; END IF;

  UPDATE public.ucat_student_study_plan_exposure_debts debt
  SET debt_units = greatest(
        0,
        debt.debt_units - CASE
          WHEN debt.question_stem_category_id IS NULL THEN v_credit
          WHEN cardinality(v_category_ids) = 0 THEN 0
          WHEN debt.question_stem_category_id = ANY(v_category_ids)
            THEN v_credit / cardinality(v_category_ids)
          ELSE 0
        END
      ),
      updated_at = clock_timestamp()
  WHERE debt.student_id = NEW.student_id
    AND debt.section_id = NEW.ucat_section_id
    AND (
      debt.question_stem_category_id IS NULL
      OR debt.question_stem_category_id = ANY(v_category_ids)
    );

  DELETE FROM public.ucat_student_study_plan_exposure_debts debt
  WHERE debt.student_id = NEW.student_id
    AND debt.debt_units = 0;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_ucat_study_plan_completed_exposure()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER credit_ucat_study_plan_completed_exposure
AFTER UPDATE OF completed_at
ON public.student_practice_sessions
FOR EACH ROW
EXECUTE FUNCTION public.credit_ucat_study_plan_completed_exposure();

-- One indexed watermark still drives cron, but it now distinguishes a cheap
-- rollover boundary from a distributed weekly generation boundary.
CREATE OR REPLACE FUNCTION public.recompute_ucat_study_plan_maintenance_at(
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
  v_weekly_at TIMESTAMPTZ;
  v_rollover_on DATE;
  v_rollover_at TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_jitter_seconds INTEGER;
BEGIN
  SELECT
    coalesce(nullif(student.timezone, ''), 'Australia/Adelaide'),
    profile.next_weekly_replan_on
  INTO v_timezone, v_weekly_on
  FROM public.ucat_student_study_plan_profiles profile
  JOIN public.students student ON student.id = profile.student_id
  WHERE profile.student_id = p_student_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_weekly_on IS NOT NULL THEN
    v_jitter_seconds := mod(
      hashtextextended(
        p_student_id::TEXT || ':' || v_weekly_on::TEXT,
        0
      )::NUMERIC + 9223372036854775808::NUMERIC,
      86400
    )::INTEGER;
    v_weekly_at := (
      v_weekly_on::TIMESTAMP + make_interval(secs => v_jitter_seconds)
    ) AT TIME ZONE v_timezone;
  END IF;

  WITH active_dates AS (
    SELECT DISTINCT task.scheduled_date
    FROM public.ucat_student_study_plan_generations generation
    JOIN public.ucat_student_study_plan_tasks task
      ON task.generation_id = generation.id
    WHERE generation.student_id = p_student_id
      AND generation.superseded_at IS NULL
      AND task.status IN ('planned', 'partial')
      AND NOT coalesce((task.launch_config ->> 'optional')::BOOLEAN, FALSE)
  ), ordered_dates AS (
    SELECT scheduled_date, row_number() OVER (ORDER BY scheduled_date) AS position
    FROM active_dates
  )
  SELECT scheduled_date INTO v_rollover_on
  FROM ordered_dates
  WHERE position = 2;

  IF v_rollover_on IS NOT NULL THEN
    v_rollover_at := v_rollover_on::TIMESTAMP AT TIME ZONE v_timezone;
  END IF;

  SELECT min(candidate.at_time) INTO v_next
  FROM (VALUES (v_weekly_at), (v_rollover_at)) candidate(at_time)
  WHERE candidate.at_time IS NOT NULL;

  UPDATE public.ucat_student_study_plan_profiles
  SET next_weekly_replan_at = v_weekly_at,
      next_rollover_at = v_rollover_at,
      next_maintenance_at = v_next
  WHERE student_id = p_student_id;
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_ucat_study_plan_maintenance_at(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_ucat_study_plan_maintenance_at(UUID)
  TO service_role;

CREATE FUNCTION public.rollover_ucat_study_plan_for_student(
  p_student_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation_id UUID;
  v_timezone TEXT;
  v_today DATE;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER := 0;
BEGIN
  SELECT
    generation.id,
    coalesce(nullif(student.timezone, ''), 'Australia/Adelaide')
  INTO v_generation_id, v_timezone
  FROM public.ucat_student_study_plan_profiles profile
  JOIN public.students student ON student.id = profile.student_id
  JOIN public.ucat_student_study_plan_generations generation
    ON generation.student_id = profile.student_id
   AND generation.superseded_at IS NULL
  WHERE profile.student_id = p_student_id
  FOR UPDATE OF profile;

  IF NOT FOUND THEN RETURN 0; END IF;
  v_today := (v_now AT TIME ZONE v_timezone)::DATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_student_study_plan_tasks task
    WHERE task.generation_id = v_generation_id
      AND task.scheduled_date = v_today
      AND task.status IN ('planned', 'partial')
      AND NOT coalesce((task.launch_config ->> 'optional')::BOOLEAN, FALSE)
  ) THEN
    PERFORM public.recompute_ucat_study_plan_maintenance_at(p_student_id);
    RETURN 0;
  END IF;

  UPDATE public.ucat_student_study_plan_tasks task
  SET status = 'skipped',
      skipped_at = v_now,
      skipped_reason = 'rollover'
  WHERE task.generation_id = v_generation_id
    AND task.scheduled_date < v_today
    AND task.status IN ('planned', 'partial');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE public.ucat_student_study_plan_profiles
    SET last_missed_work_replan_on = v_today
    WHERE student_id = p_student_id;
  END IF;

  PERFORM public.recompute_ucat_study_plan_maintenance_at(p_student_id);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rollover_ucat_study_plan_for_student(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rollover_due_ucat_study_plan_tasks(
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (students_processed INTEGER, tasks_skipped INTEGER)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id UUID;
  v_students INTEGER := 0;
  v_tasks INTEGER := 0;
BEGIN
  FOR v_student_id IN
    SELECT profile.student_id
    FROM public.ucat_student_study_plan_profiles profile
    WHERE profile.study_plan_enabled
      AND profile.last_authenticated_visit_at >=
        clock_timestamp() - interval '14 days'
      AND profile.next_rollover_at <= clock_timestamp()
    ORDER BY profile.next_rollover_at, profile.student_id
    LIMIT greatest(1, least(coalesce(p_limit, 200), 1000))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_students := v_students + 1;
    v_tasks := v_tasks
      + public.rollover_ucat_study_plan_for_student(v_student_id);
  END LOOP;
  RETURN QUERY SELECT v_students, v_tasks;
END;
$$;

REVOKE ALL ON FUNCTION public.rollover_due_ucat_study_plan_tasks(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollover_due_ucat_study_plan_tasks(INTEGER)
  TO service_role;

DROP FUNCTION public.record_current_ucat_authenticated_visit();

CREATE FUNCTION public.record_current_ucat_authenticated_visit()
RETURNS TABLE (
  recorded BOOLEAN,
  refresh_pending BOOLEAN,
  plan_changed BOOLEAN
)
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
  v_plan_changed BOOLEAN := FALSE;
BEGIN
  SELECT student.id, coalesce(nullif(student.timezone, ''), 'Australia/Adelaide')
  INTO v_student_id, v_timezone
  FROM public.students student
  WHERE student.user_id = (SELECT auth.uid());

  IF v_student_id IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, FALSE;
    RETURN;
  END IF;

  SELECT * INTO v_profile
  FROM public.ucat_student_study_plan_profiles profile
  WHERE profile.student_id = v_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, FALSE;
    RETURN;
  END IF;

  v_previous_visit := v_profile.last_authenticated_visit_at;
  v_local_today := (v_now AT TIME ZONE v_timezone)::DATE;
  SELECT coalesce(
    v_profile.test_date,
    test_window.testing_ends_on,
    make_date(v_profile.test_year, 12, 31)
  ) INTO v_cycle_end
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

  IF v_profile.study_plan_enabled
    AND v_profile.setup_completed_at IS NOT NULL
    AND v_has_relationship
    AND v_local_today <= v_cycle_end
    AND v_profile.next_rollover_at <= v_now
  THEN
    v_plan_changed :=
      public.rollover_ucat_study_plan_for_student(v_student_id) > 0;
  END IF;

  SELECT * INTO v_profile
  FROM public.ucat_student_study_plan_profiles profile
  WHERE profile.student_id = v_student_id;

  v_should_refresh :=
    v_profile.study_plan_enabled
    AND v_profile.setup_completed_at IS NOT NULL
    AND v_has_relationship
    AND v_local_today <= v_cycle_end
    AND (
      v_previous_visit IS NULL
      OR v_previous_visit < v_now - interval '14 days'
      OR v_profile.last_generated_at IS NULL
      OR v_profile.next_weekly_replan_at IS NULL
      OR v_profile.next_weekly_replan_at <= v_now
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
    ),
    v_plan_changed;
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
      AND profile.next_weekly_replan_at <= clock_timestamp()
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
    ORDER BY profile.next_weekly_replan_at, profile.student_id
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

-- Reconciliation can also retire untouched future copies of a completed Learn
-- task without issuing one update per task.
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
    skipped_reason = CASE WHEN patches.patch ? 'skipped_reason'
      THEN patches.patch ->> 'skipped_reason' ELSE task.skipped_reason END,
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
    updated_at = clock_timestamp()
  FROM patches
  WHERE task.id = (patches.patch ->> 'id')::UUID
    AND task.student_id = p_student_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.batch_update_ucat_study_plan_tasks(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_ucat_study_plan_tasks(UUID, JSONB)
  TO service_role;

-- Scheduled generation no longer serialises the raw stem catalogue or up to
-- 5,000 attempts. Compact counts and tag evidence are loaded separately.
CREATE OR REPLACE FUNCTION public.get_student_ucat_study_plan_generation_bundle(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_bundle JSONB;
BEGIN
  SELECT student.user_id INTO v_user_id
  FROM public.students student
  WHERE student.id = p_student_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'student_user_not_found';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_id, 'role', 'authenticated')::TEXT,
    true
  );

  SELECT jsonb_build_object(
    'vstudent_ucat_section_set_progress', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT progress.section_id, progress.total_completed
        FROM public.vstudent_ucat_section_set_progress progress
      ) item
    ),
    'vstudent_ucat_my_question_progress', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT progress.category_id, progress.correct_score, progress.max_score
        FROM public.vstudent_ucat_my_question_progress progress
      ) item
    ),
    'vstudent_ucat_study_plan_readiness_evidence', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT evidence.section_id, evidence.category_id,
          evidence.readiness_scope, evidence.attempted_question_count,
          evidence.completed_practice_sessions,
          evidence.qualifying_practice_sessions,
          evidence.largest_practice_session_question_count,
          evidence.recent_accuracy, evidence.observed_pace
        FROM public.vstudent_ucat_study_plan_readiness_evidence evidence
      ) item
    ),
    'vstudent_ucat_learning_modules', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT module.id, module.title, module.kind, module.ucat_section_id,
          module.study_plan_priority, module.estimated_minutes,
          module.completion_percent, module.parent_ucat_learning_module_id,
          module.index
        FROM public.vstudent_ucat_learning_modules module
      ) item
    ),
    'vstudent_ucat_preparation_section_states', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT state.section_id, state.test_year, state.learning_graduated_at,
          state.learning_graduation_route, state.policy_version,
          state.prescribed_pace, state.prescribed_pace_set_at,
          state.pace_policy_version
        FROM public.vstudent_ucat_preparation_section_states state
      ) item
    ),
    'vstudent_ucat_preparation_timing_evidence', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT evidence.evidence_session_id, evidence.source,
          evidence.section_id, evidence.completed_at,
          evidence.prescribed_pace, evidence.observed_pace,
          evidence.accuracy, evidence.section_equivalents,
          evidence.category_ids, evidence.breadth
        FROM public.vstudent_ucat_preparation_timing_evidence evidence
        ORDER BY evidence.completed_at DESC, evidence.evidence_session_id DESC
        LIMIT 800
      ) item
    ),
    'vstudent_ucat_question_sets', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT question_set.id, question_set.name, question_set.sections,
          question_set.speed, question_set.time_limit_at_exam_speed_seconds,
          question_set.is_available_in_sets_library
        FROM public.vstudent_ucat_question_sets question_set
      ) item
    ),
    'vstudent_ucat_completed_set_assets', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT asset.asset_id AS question_set_id,
          asset.last_completed_at AS completed_at,
          NULL::UUID AS student_ucat_mock_attempt_id
        FROM public.student_ucat_completed_benchmark_assets asset
        WHERE asset.student_id = p_student_id
          AND asset.asset_type = 'set'
        ORDER BY asset.last_completed_at DESC, asset.asset_id
        LIMIT 512
      ) item
    ),
    'vstudent_ucat_mocks', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT mock.id, mock.name FROM public.vstudent_ucat_mocks mock
      ) item
    ),
    'vstudent_ucat_completed_mock_assets', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT asset.asset_id AS ucat_mock_id,
          asset.last_completed_at AS completed_at
        FROM public.student_ucat_completed_benchmark_assets asset
        WHERE asset.student_id = p_student_id
          AND asset.asset_type = 'mock'
        ORDER BY asset.last_completed_at DESC, asset.asset_id
        LIMIT 512
      ) item
    ),
    'vstudent_ucat_preparation_snapshots', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT snapshot.generated_at, snapshot.snapshot_date, snapshot.snapshot
        FROM public.vstudent_ucat_preparation_snapshots snapshot
        ORDER BY snapshot.generated_at DESC
        LIMIT 60
      ) item
    )
  ) INTO v_bundle;

  RETURN v_bundle;
END;
$$;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_study_plan_generation_bundle(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_study_plan_generation_bundle(UUID)
  TO service_role;

-- Remove only duplicated reconciliation artifacts and evidence-free same-day
-- runaway generations. Genuine Student work remains durable.
WITH duplicate_learning AS (
  SELECT
    task.id,
    row_number() OVER (
      PARTITION BY
        task.student_id,
        task.learning_module_id,
        task.matched_activity_id
      ORDER BY
        (generation.superseded_at IS NULL) DESC,
        (task.started_at IS NOT NULL) DESC,
        task.scheduled_date,
        task.created_at,
        task.id
    ) AS position
  FROM public.ucat_student_study_plan_tasks task
  JOIN public.ucat_student_study_plan_generations generation
    ON generation.id = task.generation_id
  WHERE task.task_type = 'learn'
    AND task.status = 'partial'
    AND task.completed_at IS NULL
    AND task.matched_activity_type = 'learning_module'
    AND task.matched_activity_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.ucat_student_study_plan_tasks dependent
      WHERE dependent.source_task_id = task.id
    )
)
DELETE FROM public.ucat_student_study_plan_tasks task
USING duplicate_learning duplicate
WHERE task.id = duplicate.id
  AND task.started_at IS NULL
  AND duplicate.position > 1;

-- Prune superseded leaf drafts that contain no Student evidence. Repeating the
-- delete removes review children before their equally disposable source task.
DO $$
BEGIN
  LOOP
    DELETE FROM public.ucat_student_study_plan_tasks task
    USING public.ucat_student_study_plan_generations generation
    WHERE task.generation_id = generation.id
      AND generation.superseded_at IS NOT NULL
      AND task.status IN ('planned', 'skipped')
      AND task.completed_units = 0
      AND task.started_at IS NULL
      AND task.completed_at IS NULL
      AND task.matched_activity_type IS NULL
      AND task.matched_activity_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.ucat_student_study_plan_tasks dependent
        WHERE dependent.source_task_id = task.id
      );
    EXIT WHEN NOT FOUND;
  END LOOP;
END;
$$;

WITH ranked_generations AS (
  SELECT
    generation.id,
    row_number() OVER (
      PARTITION BY
        generation.student_id,
        (generation.generated_at AT TIME ZONE coalesce(
          nullif(student.timezone, ''),
          'Australia/Adelaide'
        ))::DATE
      ORDER BY generation.generated_at DESC, generation.id
    ) AS position
  FROM public.ucat_student_study_plan_generations generation
  JOIN public.students student ON student.id = generation.student_id
  WHERE generation.superseded_at IS NOT NULL
)
DELETE FROM public.ucat_student_study_plan_generations generation
USING ranked_generations ranked
WHERE generation.id = ranked.id
  AND ranked.position > 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.ucat_student_study_plan_tasks task
    WHERE task.generation_id = generation.id
  );

-- Task inserts and deletes can change the next planned-day rollover boundary.
CREATE FUNCTION public.refresh_ucat_study_plan_maintenance_after_task_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student_id UUID;
BEGIN
  FOR v_student_id IN SELECT DISTINCT student_id FROM new_task_rows LOOP
    PERFORM public.recompute_ucat_study_plan_maintenance_at(v_student_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER refresh_ucat_study_plan_maintenance_after_task_insert
AFTER INSERT ON public.ucat_student_study_plan_tasks
REFERENCING NEW TABLE AS new_task_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_ucat_study_plan_maintenance_after_task_insert();

CREATE FUNCTION public.refresh_ucat_study_plan_maintenance_after_task_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student_id UUID;
BEGIN
  FOR v_student_id IN SELECT DISTINCT student_id FROM old_task_rows LOOP
    PERFORM public.recompute_ucat_study_plan_maintenance_at(v_student_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER refresh_ucat_study_plan_maintenance_after_task_delete
AFTER DELETE ON public.ucat_student_study_plan_tasks
REFERENCING OLD TABLE AS old_task_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_ucat_study_plan_maintenance_after_task_delete();

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

-- Pre-public launch is the maintenance window for reclaiming the old runaway
-- generation bloat immediately. The table is intentionally small enough for
-- this one exclusive rewrite; future maintenance relies on normal autovacuum.
CLUSTER public.ucat_student_study_plan_tasks
  USING ucat_student_study_plan_tasks_pkey;

ANALYZE public.ucat_student_study_plan_tasks;
ANALYZE public.ucat_student_study_plan_generations;
ANALYZE public.ucat_student_study_plan_profiles;
ANALYZE public.ucat_student_study_plan_exposure_debts;

COMMENT ON COLUMN public.ucat_student_study_plan_profiles.next_weekly_replan_at IS
  'Deterministically jittered instant within the Student-local weekly due day.';
COMMENT ON COLUMN public.ucat_student_study_plan_profiles.next_rollover_at IS
  'Student-local midnight starting the next day with planned work, when earlier carry-over becomes missed.';
COMMENT ON COLUMN public.ucat_student_study_plan_profiles.next_maintenance_at IS
  'Indexed minimum of the next cheap rollover and distributed weekly generation boundary.';
COMMENT ON COLUMN public.ucat_student_learning_module_progress.study_plan_task_id IS
  'Explicit Study-plan Learning task that owns progress when Learn was launched from the plan; null for independent Learn activity.';
