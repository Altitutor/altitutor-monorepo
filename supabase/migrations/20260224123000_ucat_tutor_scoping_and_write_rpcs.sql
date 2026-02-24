-- ==========================================
-- UCAT tutor scoping + atomic write RPCs
-- ==========================================

-- Helper: constrain which UCAT students a tutor can view
CREATE OR REPLACE FUNCTION public.can_current_tutor_view_ucat_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.classes_staff cst
      ON cst.class_id = c.id
     AND cst.unassigned_at IS NULL
    JOIN public.classes_students cs
      ON cs.class_id = c.id
     AND cs.unenrolled_at IS NULL
    WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND cst.staff_id = public.current_tutor_id()
      AND cs.student_id = p_student_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_current_tutor_view_ucat_student(UUID) TO authenticated;

-- Re-scope tutor student views to tutor-student class relationship
CREATE OR REPLACE VIEW public.vtutor_ucat_student_question_attempts
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  sqa.student_question_set_attempt_id,
  sqa.question_id,
  sqa.question_answer_option_id,
  sqa.answer_snapshot,
  sqa.score,
  sqa.is_flagged,
  sqa.is_submitted,
  sqa.attempted_at,
  sqa.time_spent_seconds
FROM public.student_question_attempts sqa
JOIN public.students s ON s.id = sqa.student_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqa.student_id);

CREATE OR REPLACE VIEW public.vtutor_ucat_student_set_attempts
WITH (security_invoker = false)
AS
SELECT
  sqsa.id AS attempt_id,
  sqsa.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  sqsa.question_set_id AS set_id,
  qs.description AS set_name,
  sqsa.score_points,
  sqsa.total_points,
  sqsa.scaled_score,
  sqsa.attempted_at,
  sqsa.completed_at
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);

CREATE OR REPLACE VIEW public.vtutor_ucat_student_set_attempt_detail
WITH (security_invoker = false)
AS
SELECT
  sqsa.id AS attempt_id,
  sqsa.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  sqsa.question_set_id,
  qs.description AS set_description,
  sqsa.score_points,
  sqsa.total_points,
  sqsa.scaled_score,
  sqsa.time_taken_seconds,
  sqsa.attempted_at,
  sqsa.completed_at,
  (
    SELECT json_agg(
      json_build_object(
        'question_id', q.id,
        'stem_id', q.question_stem_id,
        'index', q.index,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'student_score', sqa.score,
        'was_correct', (sqa.score > 0),
        'student_answer_snapshot', sqa.answer_snapshot,
        'correct_answer_summary', (
          SELECT json_build_object(
            'correct_option_id', (
              SELECT qao.id
              FROM public.question_answer_options qao
              WHERE qao.question_id = q.id AND qao.is_answer
              LIMIT 1
            )
          )
        )
      )
      ORDER BY q.index
    )
    FROM public.student_question_attempts sqa
    JOIN public.ucat_questions q ON q.id = sqa.question_id
    WHERE sqa.student_question_set_attempt_id = sqsa.id
      AND sqa.is_submitted
  ) AS questions
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);

CREATE OR REPLACE VIEW public.vtutor_ucat_student_mock_attempts
WITH (security_invoker = false)
AS
SELECT
  suma.id,
  suma.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  suma.ucat_mock_id,
  m.name AS mock_name,
  suma.attempted_at,
  suma.completed_at
FROM public.student_ucat_mock_attempts suma
JOIN public.students s ON s.id = suma.student_id
JOIN public.ucat_mocks m ON m.id = suma.ucat_mock_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(suma.student_id);

CREATE OR REPLACE VIEW public.vtutor_ucat_student_mock_attempt_detail
WITH (security_invoker = false)
AS
SELECT
  suma.id,
  suma.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  suma.ucat_mock_id,
  m.name AS mock_name,
  suma.attempted_at,
  suma.completed_at,
  (
    SELECT json_agg(
      json_build_object(
        'attempt_id', sqsa.id,
        'question_set_id', sqsa.question_set_id,
        'score_points', sqsa.score_points,
        'total_points', sqsa.total_points,
        'scaled_score', sqsa.scaled_score,
        'attempted_at', sqsa.attempted_at,
        'completed_at', sqsa.completed_at
      )
      ORDER BY sqsa.attempted_at
    )
    FROM public.student_question_set_attempts sqsa
    WHERE sqsa.student_ucat_mock_attempt_id = suma.id
  ) AS set_attempts
FROM public.student_ucat_mock_attempts suma
JOIN public.students s ON s.id = suma.student_id
JOIN public.ucat_mocks m ON m.id = suma.ucat_mock_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(suma.student_id);

CREATE OR REPLACE VIEW public.vtutor_ucat_student_progress_summary
WITH (security_invoker = false)
AS
SELECT
  st.id AS student_id,
  st.first_name || ' ' || st.last_name AS student_name,
  (
    SELECT COUNT(*)::INT
    FROM public.student_question_set_attempts sqsa
    WHERE sqsa.student_id = st.id
      AND sqsa.completed_at IS NOT NULL
  ) AS total_sets_attempted,
  (
    SELECT COUNT(*)::INT
    FROM public.student_ucat_mock_attempts suma
    WHERE suma.student_id = st.id
      AND suma.completed_at IS NOT NULL
  ) AS total_mocks_attempted,
  (
    SELECT AVG(sqsa.score_points)
    FROM public.student_question_set_attempts sqsa
    WHERE sqsa.student_id = st.id
      AND sqsa.completed_at IS NOT NULL
  ) AS avg_score_points,
  (
    SELECT AVG(sqsa.scaled_score)
    FROM public.student_question_set_attempts sqsa
    WHERE sqsa.student_id = st.id
      AND sqsa.completed_at IS NOT NULL
  ) AS avg_scaled_score,
  (
    SELECT MAX(sqsa.attempted_at)
    FROM public.student_question_set_attempts sqsa
    WHERE sqsa.student_id = st.id
  ) AS last_attempted_at
FROM public.students st
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(st.id);

-- ==========================================
-- Atomic write RPCs for tutor-web UCAT APIs
-- ==========================================

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_is_private BOOLEAN,
  p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_staff_id UUID;
  v_question JSONB;
  v_question_id UUID;
  v_option JSONB;
  v_tag_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_stem_id IS NULL THEN
    INSERT INTO public.question_stems (
      section_id,
      question_stem_category_id,
      stem_text,
      is_private,
      created_by,
      updated_by
    ) VALUES (
      p_section_id,
      p_question_stem_category_id,
      COALESCE(p_stem_text, '{}'::jsonb),
      COALESCE(p_is_private, false),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_stem_id;
  ELSE
    UPDATE public.question_stems
    SET section_id = p_section_id,
        question_stem_category_id = p_question_stem_category_id,
        stem_text = COALESCE(p_stem_text, '{}'::jsonb),
        is_private = COALESCE(p_is_private, false),
        updated_by = v_staff_id
    WHERE id = p_stem_id
    RETURNING id INTO v_stem_id;

    IF v_stem_id IS NULL THEN
      RAISE EXCEPTION 'question_stem_not_found';
    END IF;

    DELETE FROM public.questions_question_tags
    WHERE question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = v_stem_id);

    DELETE FROM public.question_answer_options
    WHERE question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = v_stem_id);

    DELETE FROM public.ucat_questions
    WHERE question_stem_id = v_stem_id;
  END IF;

  FOR v_question IN SELECT * FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb))
  LOOP
    INSERT INTO public.ucat_questions (
      question_stem_id,
      question_text,
      index,
      difficulty,
      time_burden_seconds,
      question_type,
      created_by,
      updated_by
    ) VALUES (
      v_stem_id,
      COALESCE(v_question->'question_text', '{}'::jsonb),
      COALESCE((v_question->>'index')::INTEGER, 1),
      NULLIF(v_question->>'difficulty', '')::NUMERIC,
      NULLIF(v_question->>'time_burden_seconds', '')::INTEGER,
      COALESCE((v_question->>'question_type')::public.ucat_question_type, 'multiple_choice'::public.ucat_question_type),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_question_id;

    FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_question->'answer_options', '[]'::jsonb))
    LOOP
      INSERT INTO public.question_answer_options (
        question_id,
        answer_text,
        answer_explanation,
        index,
        is_answer,
        image_file_id,
        created_by,
        updated_by
      ) VALUES (
        v_question_id,
        COALESCE(v_option->'answer_text', '{}'::jsonb),
        v_option->'answer_explanation',
        COALESCE((v_option->>'index')::INTEGER, 1),
        COALESCE((v_option->>'is_answer')::BOOLEAN, false),
        NULLIF(v_option->>'image_file_id', '')::UUID,
        v_staff_id,
        v_staff_id
      );
    END LOOP;

    FOR v_tag_id IN
      SELECT DISTINCT NULLIF(value::TEXT, '')::UUID
      FROM jsonb_array_elements_text(COALESCE(v_question->'tag_ids', '[]'::jsonb))
    LOOP
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO public.questions_question_tags (question_id, tag_id, created_by)
        VALUES (v_question_id, v_tag_id, v_staff_id)
        ON CONFLICT (question_id, tag_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_stem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_stem(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.question_stems WHERE id = p_stem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_delete_question_stem(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_set(
  p_set_id UUID,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_is_private BOOLEAN,
  p_is_student_generated BOOLEAN,
  p_question_ids JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_staff_id UUID;
  v_question_id UUID;
  v_index INTEGER := 0;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_set_id IS NULL THEN
    INSERT INTO public.question_sets (
      description,
      time_limit_seconds,
      is_private,
      is_student_generated,
      created_by,
      updated_by
    ) VALUES (
      p_description,
      p_time_limit_seconds,
      COALESCE(p_is_private, false),
      COALESCE(p_is_student_generated, false),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_set_id;
  ELSE
    UPDATE public.question_sets
    SET description = p_description,
        time_limit_seconds = p_time_limit_seconds,
        is_private = COALESCE(p_is_private, false),
        is_student_generated = COALESCE(p_is_student_generated, false),
        updated_by = v_staff_id
    WHERE id = p_set_id
    RETURNING id INTO v_set_id;

    IF v_set_id IS NULL THEN
      RAISE EXCEPTION 'question_set_not_found';
    END IF;

    DELETE FROM public.questions_sets WHERE question_set_id = v_set_id;
  END IF;

  FOR v_question_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_question_ids, '[]'::jsonb))
  LOOP
    IF v_question_id IS NOT NULL THEN
      v_index := v_index + 1;
      INSERT INTO public.questions_sets (
        question_id,
        question_set_id,
        index,
        created_by,
        updated_by
      ) VALUES (
        v_question_id,
        v_set_id,
        v_index,
        v_staff_id,
        v_staff_id
      );
    END IF;
  END LOOP;

  RETURN v_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, INTEGER, BOOLEAN, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.question_sets WHERE id = p_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_delete_question_set(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_mock(
  p_mock_id UUID,
  p_name TEXT,
  p_is_private BOOLEAN,
  p_set_ids JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
  v_staff_id UUID;
  v_set_id UUID;
  v_index INTEGER := 0;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_mock_id IS NULL THEN
    INSERT INTO public.ucat_mocks (
      name,
      is_private,
      created_by,
      updated_by
    ) VALUES (
      COALESCE(NULLIF(p_name, ''), 'Untitled Mock'),
      COALESCE(p_is_private, false),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_mock_id;
  ELSE
    UPDATE public.ucat_mocks
    SET name = COALESCE(NULLIF(p_name, ''), name),
        is_private = COALESCE(p_is_private, false),
        updated_by = v_staff_id
    WHERE id = p_mock_id
    RETURNING id INTO v_mock_id;

    IF v_mock_id IS NULL THEN
      RAISE EXCEPTION 'mock_not_found';
    END IF;

    DELETE FROM public.question_sets_ucat_mocks WHERE ucat_mock_id = v_mock_id;
  END IF;

  FOR v_set_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_set_ids, '[]'::jsonb))
  LOOP
    IF v_set_id IS NOT NULL THEN
      v_index := v_index + 1;
      INSERT INTO public.question_sets_ucat_mocks (
        question_set_id,
        ucat_mock_id,
        index,
        created_by,
        updated_by
      ) VALUES (
        v_set_id,
        v_mock_id,
        v_index,
        v_staff_id,
        v_staff_id
      );
    END IF;
  END LOOP;

  RETURN v_mock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_mock(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.ucat_mocks WHERE id = p_mock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_delete_mock(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_assign_set_sessions(
  p_set_id UUID,
  p_session_ids JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_session_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  DELETE FROM public.question_sets_sessions WHERE question_set_id = p_set_id;

  FOR v_session_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_session_ids, '[]'::jsonb))
  LOOP
    IF v_session_id IS NOT NULL THEN
      INSERT INTO public.question_sets_sessions (
        question_set_id,
        session_id,
        created_by,
        updated_by
      ) VALUES (
        p_set_id,
        v_session_id,
        v_staff_id,
        v_staff_id
      )
      ON CONFLICT (question_set_id, session_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_assign_set_sessions(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_assign_mock_sessions(
  p_mock_id UUID,
  p_session_ids JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_session_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  DELETE FROM public.mocks_sessions WHERE ucat_mock_id = p_mock_id;

  FOR v_session_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_session_ids, '[]'::jsonb))
  LOOP
    IF v_session_id IS NOT NULL THEN
      INSERT INTO public.mocks_sessions (
        ucat_mock_id,
        session_id,
        created_by,
        updated_by
      ) VALUES (
        p_mock_id,
        v_session_id,
        v_staff_id,
        v_staff_id
      )
      ON CONFLICT (ucat_mock_id, session_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_assign_mock_sessions(UUID, JSONB) TO authenticated;
