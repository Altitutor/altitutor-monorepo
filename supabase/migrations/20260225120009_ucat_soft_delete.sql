-- ========================
-- UCAT Soft Delete: deleted_at / deleted_by on base tables; student views exclude deleted; tutor views expose deleted_at
-- ========================

-- 1. Add deleted_at and deleted_by to base tables
ALTER TABLE public.ucat_mocks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id);

ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id);

ALTER TABLE public.question_stems
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id);

ALTER TABLE public.ucat_questions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id);

ALTER TABLE public.question_answer_options
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id);

-- 2. Partial indexes for active lists
CREATE INDEX IF NOT EXISTS idx_ucat_mocks_active ON public.ucat_mocks(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_question_sets_active ON public.question_sets(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_question_stems_active ON public.question_stems(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ucat_questions_active ON public.ucat_questions(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_question_answer_options_active ON public.question_answer_options(id) WHERE deleted_at IS NULL;

-- 3. Student views: exclude deleted rows

DROP VIEW IF EXISTS public.vstudent_ucat_mocks;
CREATE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks qsum WHERE qsum.ucat_mock_id = m.id) AS set_count
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false AND m.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_mock_detail;
CREATE VIEW public.vstudent_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'name', qs.name, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.is_private = false AND qs.deleted_at IS NULL
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false AND m.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_question_sets;
CREATE VIEW public.vstudent_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false AND qs.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_question_set_detail;
CREATE VIEW public.vstudent_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.created_at,
  qs.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'stem_id', st.id,
        'stem_text', st.stem_text,
        'questions_meta', (
          SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index)
          FROM public.ucat_questions q
          WHERE q.question_stem_id = qsq.question_stem_id AND q.deleted_at IS NULL
        )
      )
      ORDER BY qsq.index
    )
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st ON st.id = qsq.question_stem_id AND st.deleted_at IS NULL
    WHERE qsq.question_set_id = qs.id
  ) AS stems
FROM public.question_sets qs
WHERE public.is_ucat_student() AND qs.is_private = false AND qs.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_question_stems;
CREATE VIEW public.vstudent_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qs.stem_text,
  qs.created_at,
  qs.updated_at
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND qs.is_private = false AND qs.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_question_stems TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_detail;
CREATE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'answer_options', (
          SELECT json_agg(json_build_object(
            'id', qao.id,
            'answer_text', qao.answer_text,
            'index', qao.index,
            'image_file_id', qao.image_file_id
          ) ORDER BY qao.index)
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id AND qao.deleted_at IS NULL
        )
      ) ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id AND q.deleted_at IS NULL
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND qs.is_private = false AND qs.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;

-- 4. Tutor views: add deleted_at, deleted_by to SELECT; do not filter

DROP VIEW IF EXISTS public.vtutor_ucat_mocks;
CREATE VIEW public.vtutor_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.deleted_at,
  m.deleted_by,
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks qsum WHERE qsum.ucat_mock_id = m.id) AS set_count
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_mock_detail;
CREATE VIEW public.vtutor_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.deleted_at,
  m.deleted_by,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'name', qs.name, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_question_sets;
CREATE VIEW public.vtutor_ucat_question_sets
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.is_private,
  qs.sections,
  qs.time_limit_at_exam_speed_seconds,
  qs.speed,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::int FROM public.question_stems_question_sets qsq WHERE qsq.question_set_id = qs.id) AS stem_count,
  (
    SELECT COUNT(*)::int
    FROM public.ucat_questions q
    INNER JOIN public.question_stems_question_sets qsq ON qsq.question_stem_id = q.question_stem_id AND qsq.question_set_id = qs.id
  ) AS question_count
FROM public.question_sets qs
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_question_set_detail;
CREATE VIEW public.vtutor_ucat_question_set_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.name,
  qs.description,
  qs.time_limit_seconds,
  qs.is_student_generated,
  qs.is_private,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  (
    SELECT json_agg(
      json_build_object(
        'stem_id', st.id,
        'stem_text', st.stem_text,
        'questions_meta', (SELECT json_agg(json_build_object('id', q.id, 'index', q.index) ORDER BY q.index) FROM public.ucat_questions q WHERE q.question_stem_id = qsq.question_stem_id)
      )
      ORDER BY qsq.index
    )
    FROM public.question_stems_question_sets qsq
    JOIN public.question_stems st ON st.id = qsq.question_stem_id
    WHERE qsq.question_set_id = qs.id
  ) AS stems
FROM public.question_sets qs
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_set_detail TO authenticated;

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
   WHERE qsq.question_stem_id = qs.id) AS set_names
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = qs.updated_by
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
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'deleted_at', q.deleted_at,
        'tags', (SELECT json_agg(json_build_object('id', qt.id, 'name', qt.name)) FROM public.questions_question_tags qqt JOIN public.question_tags qt ON qt.id = qqt.tag_id WHERE qqt.question_id = q.id),
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index,
              'is_answer', qao.is_answer,
              'image_file_id', qao.image_file_id,
              'deleted_at', qao.deleted_at
            ) ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id
        )
      ) ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;
