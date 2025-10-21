-- Fix lint errors for functions by qualifying columns and casting enum to text

-- 1) has_student_selected_subjects: disambiguate column vs param
DROP FUNCTION IF EXISTS public.has_student_selected_subjects(uuid);
-- Keep original parameter name to avoid rename errors on remote
CREATE OR REPLACE FUNCTION public.has_student_selected_subjects(student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students_subjects ss
    WHERE ss.student_id = $1
  );
$$;

-- 2) get_subjects_for_student: cast enum to text for UPPER comparison
--    If p_curriculum is NULL, treat as wildcard
DROP FUNCTION IF EXISTS public.get_subjects_for_student(text, integer);
CREATE OR REPLACE FUNCTION public.get_subjects_for_student(p_curriculum text, p_year_level integer)
RETURNS SETOF public.subjects
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.subjects s
  WHERE (
    p_curriculum IS NULL OR UPPER(s.curriculum::text) = UPPER(p_curriculum)
  )
  AND (
    p_year_level IS NULL OR s.year_level = p_year_level
  )
  ORDER BY s.name;
$$;

-- 3) map_tutor_to_id: qualify column names to avoid ambiguity
DROP FUNCTION IF EXISTS public.map_tutor_to_id(text, text);
-- Keep original parameter names; use positional params to avoid ambiguity
CREATE OR REPLACE FUNCTION public.map_tutor_to_id(first_name text, last_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.first_name = $1
    AND s.last_name = $2
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- 4) get_student_subjects: avoid ambiguous id by qualifying columns
DROP FUNCTION IF EXISTS public.get_student_subjects(uuid);
-- Keep original parameter name; use positional param to avoid ambiguity
CREATE OR REPLACE FUNCTION public.get_student_subjects(student_id uuid)
RETURNS SETOF public.subjects
LANGUAGE sql
STABLE
AS $$
  SELECT sub.*
  FROM public.students_subjects ss
  JOIN public.subjects sub ON sub.id = ss.subject_id
  WHERE ss.student_id = $1
  ORDER BY sub.name;
$$;


