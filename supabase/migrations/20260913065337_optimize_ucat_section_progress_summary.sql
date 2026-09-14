-- The previous SQL function composed several deep Student views in one query.
-- PostgreSQL had to plan each nested access graph on a cold request, which
-- could exceed the hosted statement timeout even for a small result. Keep the
-- common online-only path on bounded projections and base catalogue tables.
-- In-person Students retain the existing view-backed path because their
-- session-assigned private content is intentionally more complex.

CREATE OR REPLACE FUNCTION public.get_student_ucat_section_progress_summary(
  p_section_number INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id UUID;
  v_subject_id UUID;
  v_has_online_access BOOLEAN;
  v_has_in_person_access BOOLEAN;
BEGIN
  SELECT student.id
  INTO v_student_id
  FROM public.students student
  WHERE student.user_id = (SELECT auth.uid());

  SELECT subject.id
  INTO v_subject_id
  FROM public.subjects subject
  WHERE subject.name = 'UCAT'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.student_subscriptions subscription
    WHERE subscription.student_id = v_student_id
      AND subscription.subject_id = v_subject_id
      AND subscription.status IN ('trialing', 'active', 'past_due')
    UNION ALL
    SELECT 1
    FROM public.students_online_access_manual manual_access
    WHERE manual_access.student_id = v_student_id
      AND manual_access.subject_id = v_subject_id
  )
  INTO v_has_online_access;

  SELECT EXISTS (
    SELECT 1
    FROM public.classes_students enrollment
    JOIN public.classes class ON class.id = enrollment.class_id
    WHERE enrollment.student_id = v_student_id
      AND enrollment.unenrolled_at IS NULL
      AND class.subject_id = v_subject_id
  )
  INTO v_has_in_person_access;

  IF v_student_id IS NULL
    OR NOT (v_has_online_access OR v_has_in_person_access)
  THEN
    RETURN NULL;
  END IF;

  IF v_has_in_person_access THEN
    RETURN (
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
      CROSS JOIN set_progress
    );
  END IF;

  RETURN (
    WITH selected_section AS MATERIALIZED (
      SELECT section.id, section.name, section.section_number
      FROM public.ucat_sections section
      WHERE section.section_number = p_section_number
    ),
    progress_rows AS MATERIALIZED (
      SELECT item.*
      FROM public.student_ucat_question_progress item
      JOIN selected_section section ON section.id = item.section_id
      JOIN public.ucat_questions question
        ON question.id = item.question_id
       AND question.deleted_at IS NULL
      JOIN public.question_stems stem
        ON stem.id = item.question_stem_id
       AND stem.deleted_at IS NULL
       AND stem.status = 'published'
       AND stem.access_scope = 'public'
      WHERE item.student_id = v_student_id
    ),
    weighted_progress AS (
      SELECT
        item.*,
        row_number() OVER (
          PARTITION BY item.section_id, item.question_stem_id
          ORDER BY item.question_id
        ) AS stem_question_rank
      FROM progress_rows item
    ),
    progress AS MATERIALIZED (
      SELECT
        item.category_id,
        coalesce(sum(item.best_score), 0)::INTEGER AS correct_score,
        sum(
          CASE
            WHEN item.answer_scheme = 'decision_making_binary_placement'
              THEN CASE WHEN item.stem_question_rank = 1 THEN 2 ELSE 0 END
            ELSE 1
          END
        )::INTEGER AS max_score
      FROM weighted_progress item
      GROUP BY item.category_id
    ),
    question_counts AS MATERIALIZED (
      SELECT item.question_stem_category_id, item.total_questions
      FROM public.ucat_public_question_counts_cache item
      JOIN selected_section section ON section.id = item.section_id
    ),
    category_rows AS (
      SELECT
        category.id::TEXT AS category_id,
        coalesce(category.name, 'Unknown') AS category_name,
        coalesce(progress.correct_score, 0)::INTEGER AS correct_score,
        coalesce(progress.max_score, 0)::INTEGER AS max_score,
        question_counts.total_questions::INTEGER AS total_public_questions
      FROM public.question_stem_categories category
      JOIN selected_section section ON section.id = category.ucat_section_id
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
      FROM public.question_sets question_set
      JOIN selected_section section ON section.id = question_set.section_id
      LEFT JOIN public.ucat_mocks parent ON parent.id = question_set.mock_id
      WHERE question_set.deleted_at IS NULL
        AND question_set.status = 'published'
        AND question_set.access_scope = 'public'
        AND (
          parent.id IS NULL
          OR parent.deleted_at IS NOT NULL
          OR parent.status IS DISTINCT FROM 'published'
        )
    ),
    set_progress AS (
      SELECT
        count(DISTINCT attempt.question_set_id)::INTEGER AS total_completed,
        count(DISTINCT attempt.question_set_id) FILTER (
          WHERE NOT attempt.was_timed
        )::INTEGER AS untimed_completed,
        count(DISTINCT attempt.question_set_id) FILTER (
          WHERE attempt.was_timed
        )::INTEGER AS timed_completed
      FROM public.student_question_set_attempts attempt
      JOIN public.question_sets question_set
        ON question_set.id = attempt.question_set_id
      JOIN selected_section section ON section.id = question_set.section_id
      WHERE attempt.student_id = v_student_id
        AND attempt.completed_at IS NOT NULL
        AND question_set.deleted_at IS NULL
        AND question_set.status = 'published'
        AND question_set.access_scope = 'public'
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
    CROSS JOIN set_progress
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_section_progress_summary(INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_section_progress_summary(INTEGER)
  TO authenticated;

COMMENT ON FUNCTION
  public.get_student_ucat_section_progress_summary(INTEGER) IS
  'Builds one authenticated Student section progress response; the common online-only path avoids nested Student catalogue view planning.';
