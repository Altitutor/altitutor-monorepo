-- ========================
-- UCAT System - RLS and access helpers
-- ADMINSTAFF: full access. Tutors/students: read via views, write via APIs.
-- ========================

-- UCAT subject name used for access checks
-- Tutors: assigned to a class with subject name = 'UCAT'
-- Students: enrolled in a class with subject name = 'UCAT' (unenrolled_at IS NULL)

-- is_ucat_tutor(): true if current user is staff with access to UCAT subject
CREATE OR REPLACE FUNCTION public.is_ucat_tutor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.classes_staff cs ON c.id = cs.class_id
    WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND cs.staff_id = public.current_tutor_id()
      AND cs.unassigned_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ucat_tutor() TO authenticated;
COMMENT ON FUNCTION public.is_ucat_tutor() IS 'Returns true if the current user is staff with access to UCAT (assigned to a class with subject UCAT). Use in vtutor_ucat_* views.';

-- is_ucat_student(): true if current student is in UCAT (enrolled in a class whose subject is UCAT)
CREATE OR REPLACE FUNCTION public.is_ucat_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.classes_students cs ON c.id = cs.class_id
    WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND cs.student_id = public.current_student_id()
      AND cs.unenrolled_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ucat_student() TO authenticated;
COMMENT ON FUNCTION public.is_ucat_student() IS 'Returns true if the current student is enrolled in a class with subject UCAT. Use in vstudent_ucat_* views.';

-- ========================
-- RLS: Enable on all UCAT base tables, ADMINSTAFF full access
-- ========================

ALTER TABLE public.ucat_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_stem_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_stems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions_question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_mocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sets_ucat_mocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_ucat_mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_question_set_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sets_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mocks_sessions ENABLE ROW LEVEL SECURITY;

-- Single policy per table: ADMINSTAFF full access (using cached check per workspace rules)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'ucat_sections', 'question_stem_categories', 'question_stems', 'ucat_questions',
    'question_answer_options', 'question_tags', 'questions_question_tags', 'questions_files',
    'question_sets', 'questions_sets', 'ucat_mocks', 'question_sets_ucat_mocks',
    'student_ucat_mock_attempts', 'student_question_set_attempts', 'student_question_attempts',
    'question_sets_sessions', 'mocks_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "ADMINSTAFF full access to %s" ON public.%I',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "ADMINSTAFF full access to %s" ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()))',
      t, t
    );
  END LOOP;
END $$;
