-- Keep best-attempt progress in a student-first projection. Exam-style work is
-- admitted only when its parent activity completes; standalone and Learn
-- submissions are admitted immediately.

CREATE TABLE public.student_ucat_question_progress (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  question_stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.question_stem_categories(id) ON DELETE SET NULL,
  answer_scheme TEXT NOT NULL,
  best_score NUMERIC NOT NULL,
  best_attempted_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, question_id)
);

CREATE INDEX student_ucat_question_progress_student_section_idx
  ON public.student_ucat_question_progress (student_id, section_id, category_id);

ALTER TABLE public.student_ucat_question_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_ucat_question_progress FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.student_ucat_question_progress TO service_role;

COMMENT ON TABLE public.student_ucat_question_progress IS
  'Best submitted score per Student and question, projected only from completed exam activities or immediate standalone/Learn submissions.';

CREATE OR REPLACE FUNCTION public.refresh_student_ucat_question_progress(
  p_student_id UUID,
  p_question_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_student_id IS NULL OR coalesce(cardinality(p_question_ids), 0) = 0 THEN
    RETURN;
  END IF;

  DELETE FROM public.student_ucat_question_progress progress
  WHERE progress.student_id = p_student_id
    AND progress.question_id = ANY (p_question_ids);

  INSERT INTO public.student_ucat_question_progress (
    student_id,
    question_id,
    question_stem_id,
    section_id,
    category_id,
    answer_scheme,
    best_score,
    best_attempted_at,
    updated_at
  )
  SELECT DISTINCT ON (attempt.student_id, attempt.question_id)
    attempt.student_id,
    attempt.question_id,
    question.question_stem_id,
    stem.section_id,
    stem.question_stem_category_id,
    question.answer_scheme::TEXT,
    attempt.score,
    attempt.attempted_at,
    now()
  FROM public.student_question_attempts attempt
  JOIN public.ucat_questions question ON question.id = attempt.question_id
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  LEFT JOIN public.student_question_set_attempts set_attempt
    ON set_attempt.id = attempt.student_question_set_attempt_id
  LEFT JOIN public.student_ucat_mock_attempts mock_attempt
    ON mock_attempt.id = set_attempt.student_ucat_mock_attempt_id
  LEFT JOIN public.student_practice_sessions practice
    ON practice.id = attempt.student_practice_session_id
  WHERE attempt.student_id = p_student_id
    AND attempt.question_id = ANY (p_question_ids)
    AND attempt.is_submitted
    AND (
      (
        attempt.student_question_set_attempt_id IS NULL
        AND attempt.student_practice_session_id IS NULL
      )
      OR (
        set_attempt.completed_at IS NOT NULL
        AND set_attempt.discarded_at IS NULL
        AND set_attempt.expired_at IS NULL
        AND (
          set_attempt.student_ucat_mock_attempt_id IS NULL
          OR (
            mock_attempt.completed_at IS NOT NULL
            AND mock_attempt.discarded_at IS NULL
            AND mock_attempt.expired_at IS NULL
          )
        )
      )
      OR (
        practice.completed_at IS NOT NULL
        AND practice.discarded_at IS NULL
        AND practice.expired_at IS NULL
      )
    )
  ORDER BY
    attempt.student_id,
    attempt.question_id,
    attempt.score DESC NULLS LAST,
    attempt.attempted_at DESC,
    attempt.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_student_ucat_question_progress(UUID, UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_student_ucat_question_progress(UUID, UUID[])
  TO service_role;

CREATE OR REPLACE FUNCTION public.project_immediate_ucat_question_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id UUID := coalesce(NEW.student_id, OLD.student_id);
  v_question_ids UUID[];
BEGIN
  v_question_ids := array_remove(
    ARRAY[NEW.question_id, OLD.question_id]::UUID[],
    NULL
  );

  PERFORM public.refresh_student_ucat_question_progress(
    v_student_id,
    v_question_ids
  );
  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.project_immediate_ucat_question_attempt()
  FROM PUBLIC, anon, authenticated;

-- Exam engines write many child attempts before completing their parent. Do
-- not perform a parent lookup per child: the activity trigger below projects
-- the whole batch once. Only parentless standalone/Learn work projects here.
CREATE TRIGGER project_immediate_ucat_question_attempt_insert_update
AFTER INSERT OR UPDATE OF question_id, score, is_submitted
ON public.student_question_attempts
FOR EACH ROW
WHEN (
  NEW.student_question_set_attempt_id IS NULL
  AND NEW.student_practice_session_id IS NULL
)
EXECUTE FUNCTION public.project_immediate_ucat_question_attempt();

CREATE TRIGGER project_immediate_ucat_question_attempt_delete
AFTER DELETE ON public.student_question_attempts
FOR EACH ROW
WHEN (
  OLD.student_question_set_attempt_id IS NULL
  AND OLD.student_practice_session_id IS NULL
)
EXECUTE FUNCTION public.project_immediate_ucat_question_attempt();

CREATE OR REPLACE FUNCTION public.project_completed_ucat_activity_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_question_ids UUID[];
BEGIN
  IF TG_TABLE_NAME = 'student_question_set_attempts' THEN
    SELECT array_agg(DISTINCT attempt.question_id)
    INTO v_question_ids
    FROM public.student_question_attempts attempt
    WHERE attempt.student_question_set_attempt_id = NEW.id;
  ELSIF TG_TABLE_NAME = 'student_practice_sessions' THEN
    SELECT array_agg(DISTINCT attempt.question_id)
    INTO v_question_ids
    FROM public.student_question_attempts attempt
    WHERE attempt.student_practice_session_id = NEW.id;
  ELSE
    SELECT array_agg(DISTINCT attempt.question_id)
    INTO v_question_ids
    FROM public.student_question_attempts attempt
    JOIN public.student_question_set_attempts set_attempt
      ON set_attempt.id = attempt.student_question_set_attempt_id
    WHERE set_attempt.student_ucat_mock_attempt_id = NEW.id;
  END IF;

  PERFORM public.refresh_student_ucat_question_progress(
    NEW.student_id,
    v_question_ids
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.project_completed_ucat_activity_progress()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER project_completed_ucat_set_progress
AFTER UPDATE OF completed_at, discarded_at, expired_at
ON public.student_question_set_attempts
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_activity_progress();

CREATE TRIGGER project_completed_ucat_practice_progress
AFTER UPDATE OF completed_at, discarded_at, expired_at
ON public.student_practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_activity_progress();

CREATE TRIGGER project_completed_ucat_mock_progress
AFTER UPDATE OF completed_at, discarded_at, expired_at
ON public.student_ucat_mock_attempts
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_activity_progress();

-- Backfill before switching the read facade.
INSERT INTO public.student_ucat_question_progress (
  student_id,
  question_id,
  question_stem_id,
  section_id,
  category_id,
  answer_scheme,
  best_score,
  best_attempted_at
)
SELECT DISTINCT ON (attempt.student_id, attempt.question_id)
  attempt.student_id,
  attempt.question_id,
  question.question_stem_id,
  stem.section_id,
  stem.question_stem_category_id,
  question.answer_scheme::TEXT,
  attempt.score,
  attempt.attempted_at
FROM public.student_question_attempts attempt
JOIN public.ucat_questions question ON question.id = attempt.question_id
JOIN public.question_stems stem ON stem.id = question.question_stem_id
LEFT JOIN public.student_question_set_attempts set_attempt
  ON set_attempt.id = attempt.student_question_set_attempt_id
LEFT JOIN public.student_ucat_mock_attempts mock_attempt
  ON mock_attempt.id = set_attempt.student_ucat_mock_attempt_id
LEFT JOIN public.student_practice_sessions practice
  ON practice.id = attempt.student_practice_session_id
WHERE attempt.is_submitted
  AND (
    (
      attempt.student_question_set_attempt_id IS NULL
      AND attempt.student_practice_session_id IS NULL
    )
    OR (
      set_attempt.completed_at IS NOT NULL
      AND set_attempt.discarded_at IS NULL
      AND set_attempt.expired_at IS NULL
      AND (
        set_attempt.student_ucat_mock_attempt_id IS NULL
        OR (
          mock_attempt.completed_at IS NOT NULL
          AND mock_attempt.discarded_at IS NULL
          AND mock_attempt.expired_at IS NULL
        )
      )
    )
    OR (
      practice.completed_at IS NOT NULL
      AND practice.discarded_at IS NULL
      AND practice.expired_at IS NULL
    )
  )
ORDER BY
  attempt.student_id,
  attempt.question_id,
  attempt.score DESC NULLS LAST,
  attempt.attempted_at DESC,
  attempt.id DESC;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_progress
WITH (security_invoker = false)
AS
WITH access_context AS MATERIALIZED (
  SELECT *
  FROM public.vstudent_ucat_access_context
  WHERE student_id = (SELECT public.current_student_id())
    AND has_ucat_access
), progress_stems AS MATERIALIZED (
  SELECT DISTINCT progress.question_stem_id
  FROM public.student_ucat_question_progress progress
  WHERE progress.student_id = (SELECT public.current_student_id())
), session_stems AS MATERIALIZED (
  SELECT resource.question_stem_id AS id
  FROM public.vstudent_ucat_accessible_session_resources resource
  JOIN progress_stems progress
    ON progress.question_stem_id = resource.question_stem_id
  WHERE resource.question_stem_id IS NOT NULL
  UNION
  SELECT member.question_stem_id AS id
  FROM public.vstudent_ucat_accessible_session_resources resource
  JOIN public.question_stems_question_sets member
    ON member.question_set_id = resource.question_set_id
  JOIN progress_stems progress ON progress.question_stem_id = member.question_stem_id
  UNION
  SELECT stem_member.question_stem_id AS id
  FROM public.vstudent_ucat_accessible_session_resources resource
  JOIN public.question_sets_ucat_mocks mock_member
    ON mock_member.ucat_mock_id = resource.ucat_mock_id
  JOIN public.question_stems_question_sets stem_member
    ON stem_member.question_set_id = mock_member.question_set_id
  JOIN progress_stems progress
    ON progress.question_stem_id = stem_member.question_stem_id
), learning_stems AS MATERIALIZED (
  SELECT block.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  JOIN progress_stems progress
    ON progress.question_stem_id = block.question_stem_id
  WHERE block.deleted_at IS NULL AND block.question_stem_id IS NOT NULL
  UNION
  SELECT question.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  JOIN public.ucat_questions question
    ON question.id = block.question_id AND question.deleted_at IS NULL
  JOIN progress_stems progress
    ON progress.question_stem_id = question.question_stem_id
  WHERE block.deleted_at IS NULL AND block.question_id IS NOT NULL
), accessible_progress AS (
  SELECT progress.*
  FROM public.student_ucat_question_progress progress
  CROSS JOIN access_context context
  JOIN public.ucat_questions question
    ON question.id = progress.question_id
   AND question.deleted_at IS NULL
  JOIN public.question_stems stem
    ON stem.id = progress.question_stem_id
   AND stem.deleted_at IS NULL
   AND stem.status = 'published'
  WHERE progress.student_id = (SELECT public.current_student_id())
    AND (
      (context.has_online_access AND stem.access_scope = 'public')
      OR EXISTS (SELECT 1 FROM session_stems item WHERE item.id = stem.id)
      OR EXISTS (SELECT 1 FROM learning_stems item WHERE item.id = stem.id)
    )
), weighted_progress AS (
  SELECT
    progress.*,
    row_number() OVER (
      PARTITION BY progress.section_id, progress.question_stem_id
      ORDER BY progress.question_id
    ) AS stem_question_rank
  FROM accessible_progress progress
)
SELECT
  progress.section_id,
  progress.category_id,
  coalesce(sum(progress.best_score), 0)::INTEGER AS correct_score,
  sum(
    CASE
      WHEN progress.answer_scheme = 'decision_making_binary_placement'
        THEN CASE WHEN progress.stem_question_rank = 1 THEN 2 ELSE 0 END
      ELSE 1
    END
  )::INTEGER AS max_score
FROM weighted_progress progress
GROUP BY progress.section_id, progress.category_id;

REVOKE ALL ON public.vstudent_ucat_my_question_progress
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_my_question_progress
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_student_ucat_progress_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH progress AS (
    SELECT section_id, correct_score, max_score
    FROM public.vstudent_ucat_my_question_progress
  ), totals AS (
    SELECT
      section_id,
      sum(correct_score)::INTEGER AS correct_score,
      sum(max_score)::INTEGER AS max_score
    FROM progress
    GROUP BY section_id
  ), public_counts AS (
    SELECT section_id, sum(total_questions)::INTEGER AS total_questions
    FROM public.vstudent_ucat_public_question_counts
    GROUP BY section_id
  )
  SELECT jsonb_build_object(
    'sectionProgress', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'sectionId', section.id,
          'sectionName', coalesce(section.name, 'Unknown'),
          'sectionNumber', coalesce(section.section_number, 0),
          'correctScore', coalesce(totals.correct_score, 0),
          'maxScore', coalesce(totals.max_score, 0),
          'percentage', CASE
            WHEN coalesce(totals.max_score, 0) > 0 THEN round(
              totals.correct_score::NUMERIC / totals.max_score * 100
            )::INTEGER
            ELSE 0
          END,
          'totalPublicQuestions', public_counts.total_questions
        )
        ORDER BY section.section_number
      ),
      '[]'::JSONB
    )
  )
  FROM public.vstudent_ucat_sections section
  LEFT JOIN totals ON totals.section_id = section.id
  LEFT JOIN public_counts ON public_counts.section_id = section.id;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_progress_summary()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_progress_summary()
  TO authenticated;

COMMENT ON FUNCTION public.get_student_ucat_progress_summary() IS
  'Returns all current-Student section progress from projected best attempts in one bounded database call.';
