-- UCAT AI generated approval workflow (no draft tables)
-- Adds AI/approval metadata to question_stems and enables pending->approved workflow.

-- ========================
-- 1) question_stems schema updates
-- ========================
ALTER TABLE public.question_stems
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generation_metadata JSONB,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'question_stems_approval_status_check'
      AND conrelid = 'public.question_stems'::regclass
  ) THEN
    ALTER TABLE public.question_stems
      ADD CONSTRAINT question_stems_approval_status_check
      CHECK (approval_status IN ('approved', 'pending', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_question_stems_approval_status
  ON public.question_stems(approval_status);

CREATE INDEX IF NOT EXISTS idx_question_stems_is_ai_generated
  ON public.question_stems(is_ai_generated);

CREATE INDEX IF NOT EXISTS idx_question_stems_ai_generated_approval_status
  ON public.question_stems(is_ai_generated, approval_status);

UPDATE public.question_stems
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- ========================
-- 2) Access helper update (students cannot access unapproved stems)
-- ========================
CREATE OR REPLACE FUNCTION public.can_student_access_ucat_question_stem(p_question_stem_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.question_stems qs
      WHERE qs.id = p_question_stem_id
        AND qs.deleted_at IS NULL
        AND qs.approval_status = 'approved'
    )
    AND (
      (
        public.is_ucat_online_student()
        AND EXISTS (
          SELECT 1
          FROM public.question_stems qs
          WHERE qs.id = p_question_stem_id
            AND qs.is_private = false
            AND qs.deleted_at IS NULL
            AND qs.approval_status = 'approved'
        )
      )
      OR
      (
        public.is_ucat_in_person_student()
        AND EXISTS (
          SELECT 1
          FROM public.ucat_sessions_resources usr
          JOIN public.sessions sess ON sess.id = usr.session_id
          JOIN public.classes c ON c.id = sess.class_id
          JOIN public.classes_students cs ON cs.class_id = c.id AND cs.student_id = public.current_student_id()
          WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
            AND cs.unenrolled_at IS NULL
            AND (
              usr.question_stem_id = p_question_stem_id
              OR (
                usr.question_set_id IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM public.question_stems_question_sets qsq
                  WHERE qsq.question_set_id = usr.question_set_id
                    AND qsq.question_stem_id = p_question_stem_id
                )
              )
              OR (
                usr.ucat_mock_id IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM public.question_sets_ucat_mocks qsum
                  JOIN public.question_stems_question_sets qsq ON qsq.question_set_id = qsum.question_set_id
                  WHERE qsum.ucat_mock_id = usr.ucat_mock_id
                    AND qsq.question_stem_id = p_question_stem_id
                )
              )
            )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_question_stem(UUID) TO authenticated;

-- ========================
-- 3) Tutor views include AI/approval metadata
-- ========================
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems;
CREATE VIEW public.vtutor_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns AS section_display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.is_ai_generated,
  qs.ai_generation_metadata,
  qs.approval_status,
  qs.approved_by,
  qs.approved_at,
  approved_staff.first_name AS approved_by_first_name,
  approved_staff.last_name AS approved_by_last_name,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  (SELECT COUNT(*)::INT FROM public.ucat_questions q WHERE q.question_stem_id = qs.id) AS question_count,
  (SELECT COALESCE(jsonb_agg(qset.name ORDER BY qset.updated_at DESC NULLS LAST, qset.id), '[]'::jsonb)
   FROM public.question_stems_question_sets qsq
   JOIN public.question_sets qset ON qset.id = qsq.question_set_id
     AND qset.is_student_generated = false
     AND qset.deleted_at IS NULL
   WHERE qsq.question_stem_id = qs.id) AS set_names
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = qs.updated_by
LEFT JOIN public.staff approved_staff ON approved_staff.id = qs.approved_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stems TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_detail;
CREATE VIEW public.vtutor_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.is_ai_generated,
  qs.ai_generation_metadata,
  qs.approval_status,
  qs.approved_by,
  qs.approved_at,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'answer_explanation', q.answer_explanation,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'deleted_at', q.deleted_at,
        'tags', (
          SELECT json_agg(
            json_build_object('id', qt.id, 'name', qt.name)
          )
          FROM public.questions_question_tags qqt
          JOIN public.question_tags qt ON qt.id = qqt.tag_id
          WHERE qqt.question_id = q.id
        ),
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index,
              'is_answer', qao.is_answer,
              'deleted_at', qao.deleted_at
            )
            ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id
        )
      )
      ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;

-- Approved-only list for /ucat/questions query-level exclusion.
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_approved;
CREATE VIEW public.vtutor_ucat_question_stems_approved
WITH (security_invoker = false)
AS
SELECT *
FROM public.vtutor_ucat_question_stems
WHERE approval_status = 'approved';

GRANT SELECT ON public.vtutor_ucat_question_stems_approved TO authenticated;

-- Generated-only list for /ucat/questions/generated.
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_generated;
CREATE VIEW public.vtutor_ucat_question_stems_generated
WITH (security_invoker = false)
AS
SELECT *
FROM public.vtutor_ucat_question_stems
WHERE is_ai_generated = true;

GRANT SELECT ON public.vtutor_ucat_question_stems_generated TO authenticated;

-- ========================
-- 4) RPCs for generated imports + approval actions
-- ========================
CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(
  p_section_id UUID,
  p_stems JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_ids UUID[] := ARRAY[]::UUID[];
  v_stem JSONB;
  v_stem_id UUID;
  v_ai_metadata JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN
    RAISE EXCEPTION 'invalid_stems_payload';
  END IF;

  FOR v_stem IN SELECT * FROM jsonb_array_elements(p_stems)
  LOOP
    v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
      COALESCE(NULLIF(v_stem->>'stemId', '')::UUID, NULL),
      COALESCE(NULLIF(v_stem->>'sectionId', '')::UUID, p_section_id),
      NULLIF(v_stem->>'categoryId', '')::UUID,
      COALESCE(v_stem->'stemText', '{}'::jsonb),
      true,
      COALESCE(v_stem->'questions', '[]'::jsonb)
    );

    v_ai_metadata := COALESCE(v_stem->'ai_generation_metadata', '{}'::jsonb);
    UPDATE public.question_stems
    SET is_ai_generated = true,
        ai_generation_metadata = NULLIF(v_ai_metadata, '{}'::jsonb),
        approval_status = 'pending',
        approved_by = NULL,
        approved_at = NULL
    WHERE id = v_stem_id;

    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;

  RETURN v_result_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_question_stem_approval(
  p_stem_id UUID,
  p_approval_status TEXT,
  p_auto_publish_on_approval BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_approval_status NOT IN ('approved', 'pending', 'rejected') THEN
    RAISE EXCEPTION 'invalid_approval_status';
  END IF;

  v_staff_id := public.current_tutor_id();

  UPDATE public.question_stems
  SET approval_status = p_approval_status,
      approved_by = CASE WHEN p_approval_status = 'approved' THEN v_staff_id ELSE NULL END,
      approved_at = CASE WHEN p_approval_status = 'approved' THEN NOW() ELSE NULL END,
      is_private = CASE
        WHEN p_approval_status = 'approved' AND COALESCE(p_auto_publish_on_approval, true) THEN false
        ELSE is_private
      END,
      updated_by = v_staff_id
  WHERE id = p_stem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question_stem_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_question_stem_approval(UUID, TEXT, BOOLEAN) TO authenticated;
