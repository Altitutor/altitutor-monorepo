-- Bound and consolidate the database hot paths reported by Sentry before the
-- UCAT launch. Student-facing reads stay behind authenticated RPCs; privileged
-- writes and cross-student preparation reads remain service-role only.

CREATE INDEX IF NOT EXISTS idx_ucat_study_plan_completed_benchmarks
  ON public.ucat_student_study_plan_tasks (student_id, section_id)
  WHERE task_type = 'section_benchmark' AND status = 'completed';

CREATE OR REPLACE FUNCTION
  public.get_student_ucat_completed_benchmark_sections(p_student_id UUID)
RETURNS TABLE (section_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT task.section_id
  FROM public.ucat_student_study_plan_tasks task
  WHERE task.student_id = p_student_id
    AND task.task_type = 'section_benchmark'
    AND task.status = 'completed'
    AND task.section_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_completed_benchmark_sections(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_completed_benchmark_sections(UUID)
  TO service_role;

COMMENT ON FUNCTION
  public.get_student_ucat_completed_benchmark_sections(UUID) IS
  'Returns at most the four distinct completed benchmark sections for one Student.';

CREATE OR REPLACE FUNCTION public.get_student_ucat_score_projection_evidence(
  p_student_id UUID
)
RETURNS TABLE (
  evidence_session_id TEXT,
  source TEXT,
  section_id UUID,
  section_number INTEGER,
  completed_at TIMESTAMPTZ,
  score_points NUMERIC,
  total_points NUMERIC,
  question_count INTEGER,
  section_question_count INTEGER,
  section_category_count INTEGER,
  was_timed BOOLEAN,
  prescribed_pace NUMERIC,
  observed_pace NUMERIC,
  breadth TEXT,
  category_ids UUID[],
  feedback_withheld BOOLEAN,
  is_student_generated BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH category_totals AS (
    SELECT
      category.ucat_section_id AS section_id,
      count(*)::INTEGER AS category_count
    FROM public.question_stem_categories category
    GROUP BY category.ucat_section_id
  ),
  practice_evidence AS (
    SELECT
      practice.id::TEXT AS evidence_session_id,
      'practice'::TEXT AS source,
      practice.ucat_section_id AS section_id,
      section.section_number,
      practice.completed_at,
      practice.score_points,
      practice.total_points,
      count(DISTINCT attempt.question_id)::INTEGER AS question_count,
      section.number_of_questions AS section_question_count,
      greatest(category_totals.category_count, 1)::INTEGER
        AS section_category_count,
      practice.was_timed,
      CASE
        WHEN practice.was_timed
          AND jsonb_typeof(practice.filters_snapshot -> 'timeSpeedMultiplier')
            = 'number'
        THEN (practice.filters_snapshot ->> 'timeSpeedMultiplier')::NUMERIC
        ELSE NULL::NUMERIC
      END AS prescribed_pace,
      avg(attempt.student_question_speed) FILTER (
        WHERE attempt.student_question_speed > 0
      ) AS observed_pace,
      array_remove(
        array_agg(DISTINCT stem.question_stem_category_id),
        NULL
      ) AS category_ids,
      count(DISTINCT stem.question_stem_category_id)::INTEGER AS category_count
    FROM public.student_practice_sessions practice
    JOIN public.student_question_attempts attempt
      ON attempt.student_practice_session_id = practice.id
     AND attempt.is_submitted
    JOIN public.ucat_questions question ON question.id = attempt.question_id
    JOIN public.question_stems stem ON stem.id = question.question_stem_id
    JOIN public.ucat_sections section ON section.id = practice.ucat_section_id
    LEFT JOIN category_totals ON category_totals.section_id = section.id
    WHERE practice.student_id = p_student_id
      AND practice.completed_at IS NOT NULL
      AND practice.discarded_at IS NULL
      AND practice.expired_at IS NULL
    GROUP BY
      practice.id,
      practice.ucat_section_id,
      practice.completed_at,
      practice.score_points,
      practice.total_points,
      practice.was_timed,
      practice.filters_snapshot,
      section.number_of_questions,
      section.section_number,
      category_totals.category_count
  ),
  set_evidence AS (
    SELECT
      attempt.id::TEXT AS evidence_session_id,
      CASE
        WHEN attempt.student_ucat_mock_attempt_id IS NULL THEN 'set'
        ELSE 'mock'
      END::TEXT AS source,
      stem.section_id,
      section.section_number,
      attempt.completed_at,
      attempt.score_points,
      attempt.total_points,
      count(DISTINCT question_attempt.question_id)::INTEGER AS question_count,
      section.number_of_questions AS section_question_count,
      greatest(category_totals.category_count, 1)::INTEGER
        AS section_category_count,
      attempt.was_timed,
      CASE
        WHEN attempt.was_timed THEN coalesce(attempt.set_speed, 1)
        ELSE NULL::NUMERIC
      END AS prescribed_pace,
      attempt.student_exam_speed AS observed_pace,
      array_remove(
        array_agg(DISTINCT stem.question_stem_category_id),
        NULL
      ) AS category_ids,
      count(DISTINCT stem.question_stem_category_id)::INTEGER AS category_count
    FROM public.student_question_set_attempts attempt
    JOIN public.student_question_attempts question_attempt
      ON question_attempt.student_question_set_attempt_id = attempt.id
     AND question_attempt.is_submitted
    JOIN public.ucat_questions question
      ON question.id = question_attempt.question_id
    JOIN public.question_stems stem ON stem.id = question.question_stem_id
    JOIN public.ucat_sections section ON section.id = stem.section_id
    LEFT JOIN category_totals ON category_totals.section_id = section.id
    WHERE attempt.student_id = p_student_id
      AND attempt.completed_at IS NOT NULL
      AND attempt.discarded_at IS NULL
      AND attempt.expired_at IS NULL
    GROUP BY
      attempt.id,
      attempt.student_ucat_mock_attempt_id,
      stem.section_id,
      attempt.completed_at,
      attempt.score_points,
      attempt.total_points,
      attempt.was_timed,
      attempt.set_speed,
      attempt.student_exam_speed,
      section.number_of_questions,
      section.section_number,
      category_totals.category_count
  ),
  evidence AS (
    SELECT * FROM practice_evidence
    UNION ALL
    SELECT * FROM set_evidence
  )
  SELECT
    evidence.evidence_session_id,
    evidence.source,
    evidence.section_id,
    evidence.section_number,
    evidence.completed_at,
    evidence.score_points,
    evidence.total_points,
    evidence.question_count,
    evidence.section_question_count,
    evidence.section_category_count,
    evidence.was_timed,
    evidence.prescribed_pace,
    evidence.observed_pace,
    CASE
      WHEN evidence.source = 'mock' THEN 'broad'
      WHEN evidence.section_number = 3
        AND evidence.question_count >= evidence.section_question_count * 0.5
        THEN 'broad'
      WHEN evidence.section_number = 3
        AND evidence.question_count >= evidence.section_question_count * 0.25
        THEN 'mixed'
      WHEN evidence.question_count >= evidence.section_question_count * 0.5
        AND evidence.category_count
          >= ceil(evidence.section_category_count * 0.5)
        THEN 'broad'
      WHEN evidence.category_count >= 2 THEN 'mixed'
      ELSE 'narrow'
    END::TEXT AS breadth,
    evidence.category_ids,
    evidence.source IN ('set', 'mock') AS feedback_withheld,
    evidence.source = 'practice' AS is_student_generated
  FROM evidence;
$$;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_score_projection_evidence(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_score_projection_evidence(UUID)
  TO service_role;

COMMENT ON FUNCTION public.get_student_ucat_score_projection_evidence(UUID) IS
  'Returns one Student score-evidence set with the Student predicate applied before attempt aggregation.';

CREATE OR REPLACE FUNCTION public.get_student_ucat_section_progress_summary(
  p_section_number INTEGER
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH selected_section AS (
    SELECT section.id, section.name, section.section_number
    FROM public.vstudent_ucat_sections section
    WHERE section.section_number = p_section_number
  ),
  progress AS (
    SELECT item.category_id, item.correct_score, item.max_score
    FROM public.vstudent_ucat_my_question_progress item
    JOIN selected_section section ON section.id = item.section_id
  ),
  question_counts AS (
    SELECT item.question_stem_category_id, item.total_questions
    FROM public.vstudent_ucat_public_question_counts item
    JOIN selected_section section ON section.id = item.section_id
  ),
  category_rows AS (
    SELECT
      category.id::TEXT AS category_id,
      coalesce(category.name, 'Unknown') AS category_name,
      coalesce(progress.correct_score, 0)::INTEGER AS correct_score,
      coalesce(progress.max_score, 0)::INTEGER AS max_score,
      question_counts.total_questions::INTEGER AS total_public_questions
    FROM public.vstudent_ucat_question_stem_categories category
    JOIN selected_section section
      ON section.id = category.ucat_section_id
    LEFT JOIN progress ON progress.category_id = category.id
    LEFT JOIN question_counts
      ON question_counts.question_stem_category_id = category.id

    UNION ALL

    SELECT
      '__uncategorized__'::TEXT,
      'Uncategorized'::TEXT,
      progress.correct_score::INTEGER,
      progress.max_score::INTEGER,
      question_counts.total_questions::INTEGER
    FROM progress
    LEFT JOIN question_counts
      ON question_counts.question_stem_category_id IS NULL
    WHERE progress.category_id IS NULL AND progress.max_score > 0
  ),
  category_payload AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'categoryId', category_id,
          'categoryName', category_name,
          'correctScore', correct_score,
          'maxScore', max_score,
          'percentage', CASE
            WHEN max_score > 0
              THEN round(correct_score::NUMERIC / max_score * 100)::INTEGER
            ELSE 0
          END,
          'totalPublicQuestions', total_public_questions
        )
        ORDER BY category_name
      ),
      '[]'::JSONB
    ) AS categories
    FROM category_rows
  ),
  progress_totals AS (
    SELECT
      coalesce(sum(correct_score), 0)::INTEGER AS correct_score,
      coalesce(sum(max_score), 0)::INTEGER AS max_score
    FROM progress
  ),
  question_totals AS (
    SELECT coalesce(sum(total_questions), 0)::INTEGER AS total_questions
    FROM question_counts
  ),
  public_sets AS (
    SELECT
      count(*)::INTEGER AS total_sets,
      count(*) FILTER (
        WHERE coalesce(question_set.time_limit_seconds, 0) > 0
      )::INTEGER AS timed_sets
    FROM public.vstudent_ucat_question_sets question_set
    WHERE question_set.section_number = p_section_number
      AND question_set.is_available_in_sets_library
  ),
  set_progress AS (
    SELECT
      coalesce(sum(item.total_completed), 0)::INTEGER AS total_completed,
      coalesce(sum(item.untimed_completed), 0)::INTEGER AS untimed_completed,
      coalesce(sum(item.timed_completed), 0)::INTEGER AS timed_completed
    FROM public.vstudent_ucat_section_set_progress item
    JOIN selected_section section ON section.id = item.section_id
  )
  SELECT jsonb_build_object(
    'section', jsonb_build_object(
      'sectionId', section.id,
      'sectionName', coalesce(section.name, 'Unknown'),
      'sectionNumber', section.section_number,
      'correctScore', progress_totals.correct_score,
      'maxScore', progress_totals.max_score,
      'percentage', CASE
        WHEN progress_totals.max_score > 0 THEN round(
          progress_totals.correct_score::NUMERIC
            / progress_totals.max_score * 100
        )::INTEGER
        ELSE 0
      END,
      'totalPublicQuestions', question_totals.total_questions
    ),
    'categoryProgress', category_payload.categories,
    'totalPublicSets', public_sets.total_sets,
    'totalPublicUntimedSets', public_sets.total_sets - public_sets.timed_sets,
    'totalPublicTimedSets', public_sets.timed_sets,
    'setsCompleted', set_progress.total_completed,
    'untimedSetsCompleted', set_progress.untimed_completed,
    'timedSetsCompleted', set_progress.timed_completed
  )
  FROM selected_section section
  CROSS JOIN category_payload
  CROSS JOIN progress_totals
  CROSS JOIN question_totals
  CROSS JOIN public_sets
  CROSS JOIN set_progress;
$$;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_section_progress_summary(INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_section_progress_summary(INTEGER)
  TO authenticated;

COMMENT ON FUNCTION
  public.get_student_ucat_section_progress_summary(INTEGER) IS
  'Builds one section progress response in PostgreSQL instead of five concurrent PostgREST requests.';

CREATE OR REPLACE FUNCTION public.upsert_ucat_learning_module_block_progress(
  p_student_id UUID,
  p_learning_module_block_id UUID,
  p_interaction_state JSONB DEFAULT NULL,
  p_completed BOOLEAN DEFAULT false,
  p_manually_completed BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.ucat_student_learning_module_block_progress (
    student_id,
    learning_module_block_id,
    interaction_state,
    manually_completed,
    completed_at
  )
  VALUES (
    p_student_id,
    p_learning_module_block_id,
    coalesce(p_interaction_state, '{}'::JSONB),
    coalesce(p_manually_completed, false),
    CASE
      WHEN coalesce(p_completed, false)
        OR coalesce(p_manually_completed, false)
        THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (student_id, learning_module_block_id) DO UPDATE
  SET
    interaction_state = coalesce(
      p_interaction_state,
      public.ucat_student_learning_module_block_progress.interaction_state
    ),
    manually_completed = coalesce(
      p_manually_completed,
      public.ucat_student_learning_module_block_progress.manually_completed
    ),
    completed_at = CASE
      WHEN coalesce(p_completed, false)
        OR coalesce(p_manually_completed, false)
        THEN now()
      ELSE public.ucat_student_learning_module_block_progress.completed_at
    END;
$$;

REVOKE ALL ON FUNCTION
  public.upsert_ucat_learning_module_block_progress(
    UUID, UUID, JSONB, BOOLEAN, BOOLEAN
  )
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.upsert_ucat_learning_module_block_progress(
    UUID, UUID, JSONB, BOOLEAN, BOOLEAN
  )
  TO service_role;

COMMENT ON FUNCTION
  public.upsert_ucat_learning_module_block_progress(
    UUID, UUID, JSONB, BOOLEAN, BOOLEAN
  ) IS
  'Atomically creates or updates block progress without a select-then-insert race.';
